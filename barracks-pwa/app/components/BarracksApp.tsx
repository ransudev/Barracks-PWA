"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/app/components/layout/AppShell";
import { LandingPage } from "@/app/pages/public/LandingPage";
import { PageRouter } from "@/app/pages/PageRouter";
import { ScreenLoading } from "@/app/components/ui/ScreenLoading";
import { Toast } from "@/app/components/ui";
import { isManagementRole } from "@/app/constants/roles";
import type { ViewId } from "@/app/types/domain";
import { canAccessView, canonicalView, isCustomerView, isProtectedView, isSupplierView, isWorkspaceView, workspaceAreaForView } from "@/app/utils/view";
import { isKnownAppPath, pathForView, viewForPath } from "@/app/utils/routes";
import { apiRequest, clearApiCache, readApiBody, type ApiUser } from "@/app/lib/api";

const LoginPage = dynamic(() => import("@/app/pages/auth/LoginPage").then((module) => module.LoginPage), { loading: ScreenLoading });
const CustomerDashboard = dynamic(() => import("@/app/pages/customer/CustomerDashboard").then((module) => module.CustomerDashboard), { loading: ScreenLoading });
const CustomerBookingPage = dynamic(() => import("@/app/pages/customer/CustomerBookingPage").then((module) => module.CustomerBookingPage), { loading: ScreenLoading });
const SupplierPortal = dynamic(() => import("@/app/pages/supplier/SupplierPortal").then((module) => module.SupplierPortal), { loading: ScreenLoading });

function defaultViewForUser(user: ApiUser): ViewId {
  if (isManagementRole(user.role)) return "admin-dashboard";
  if (user.role === "customer") return "customer-dashboard";
  if (user.role === "supplier") return "supplier-dashboard";
  return "staff-dashboard";
}

function SessionLoading() {
  return <main className="route-loading" aria-live="polite"><p className="eyebrow">Barracks</p><h1>Restoring your workspace</h1><p>Checking your account session…</p></main>;
}

export function BarracksApp() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingView, setPendingView] = useState<ViewId | null>(null);
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [toast, setToast] = useState("");
  const sessionVersion = useRef(0);

  const onToast = useCallback((message: string) => {
    setToast(message);
    if (typeof window !== "undefined") window.setTimeout(() => setToast(""), 2800);
  }, []);

  function navigate(nextView: ViewId, replace = false) {
    const nextPath = pathForView(nextView);
    if (pathname === nextPath) return;
    // Every app screen lives in this persistent layout; its page renders null.
    // Next's History API integration updates usePathname without an RSC trip.
    if (replace) {
      window.history.replaceState(null, "", nextPath);
    } else {
      window.history.pushState(null, "", nextPath);
    }
  }

  const routeView = viewForPath(pathname);
  const view = pendingView && pathname === pathForView("login") ? "login" : routeView;

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    async function loadSession() {
      if (refreshing) return;
      refreshing = true;
      const version = ++sessionVersion.current;
      try {
        const response = await apiRequest("/api/auth/me", { cache: "no-store" });
        const body = await readApiBody<{ success: boolean; user?: ApiUser }>(response);
        if (cancelled || version !== sessionVersion.current) return;
        if (response.ok && body?.success && body.user) {
          setCurrentUser(body.user);
        } else {
          setCurrentUser(null);
          clearApiCache();
        }
      } catch {
        if (!cancelled && version === sessionVersion.current) {
          setCurrentUser(null);
          clearApiCache();
        }
      } finally {
        refreshing = false;
        if (!cancelled && version === sessionVersion.current) setSessionLoading(false);
      }
    }
    const refreshSession = () => {
      if (document.visibilityState === "visible") {
        clearApiCache();
        void loadSession();
      }
    };
    void loadSession();
    window.addEventListener("focus", refreshSession);
    document.addEventListener("visibilitychange", refreshSession);
    window.addEventListener("barracks:session-expired", refreshSession);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshSession);
      document.removeEventListener("visibilitychange", refreshSession);
      window.removeEventListener("barracks:session-expired", refreshSession);
    };
  }, []);

  useEffect(() => {
    if (sessionLoading || !isKnownAppPath(pathname)) return;
    const requestedView = viewForPath(pathname);
    if (!currentUser) {
      if (isProtectedView(requestedView)) {
        // Keep the requested destination while the login route is displayed.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPendingView(requestedView);
        router.replace(pathForView("login"));
      }
    } else if (requestedView === "login" || !canAccessView(requestedView, currentUser.role)) {
      router.replace(pathForView(defaultViewForUser(currentUser)));
    } else if (canonicalView(requestedView) !== requestedView) {
      router.replace(pathForView(canonicalView(requestedView)));
    }
  }, [currentUser, pathname, router, sessionLoading]);

  if (!isKnownAppPath(pathname)) return null;

  function go(nextView: ViewId) {
    if (isCustomerView(nextView) && (!currentUser || currentUser.role !== "customer")) {
      setPendingView(nextView); navigate("login"); onToast("Sign in with a customer account to continue"); return;
    }
    if (isSupplierView(nextView) && (!currentUser || currentUser.role !== "supplier")) {
      setPendingView(nextView); navigate("login"); onToast("Sign in with a supplier account to continue"); return;
    }
    if (isWorkspaceView(nextView) && (!currentUser || currentUser.role === "customer" || currentUser.role === "supplier")) {
      setPendingView(nextView); navigate("login"); onToast("Sign in to access the workspace"); return;
    }
    if (!canAccessView(nextView, currentUser?.role ?? null)) { onToast("You do not have access to this page"); return; }
    navigate(canonicalView(nextView));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
  }

  function handleLogin(user: ApiUser) {
    sessionVersion.current++;
    clearApiCache();
    setSessionLoading(false);
    const destination = pendingView && canAccessView(pendingView, user.role) ? pendingView : defaultViewForUser(user);
    setCurrentUser(user); setPendingView(null); navigate(canonicalView(destination)); onToast(`Signed in as ${user.firstName} ${user.lastName}`);
  }

  async function handleSignOut() {
    sessionVersion.current++;
    clearApiCache();
    let message = "Signed out";
    try {
      const response = await apiRequest("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to sign out");
    } catch (error) { message = error instanceof Error ? error.message : "Unable to sign out"; }
    finally { setCurrentUser(null); setPendingView(null); router.replace(pathForView("landing")); onToast(message); }
  }

  const waitingForSession = sessionLoading && (!currentUser || !canAccessView(view, currentUser.role));
  if (waitingForSession && view !== "landing") return <SessionLoading />;
  if (view === "landing") return <><LandingPage go={go} /><Toast message={toast} onClose={() => setToast("")} /></>;
  if (view === "login" && currentUser) return <SessionLoading />;
  if (view === "login") return <><LoginPage go={go} onLogin={handleLogin} /><Toast message={toast} onClose={() => setToast("")} /></>;

  if ((view === "customer-dashboard" || view === "customer-profile") && currentUser?.role === "customer") {
    return <><CustomerDashboard go={go} onToast={onToast} onSignOut={handleSignOut} user={currentUser} /><Toast message={toast} onClose={() => setToast("")} /></>;
  }
  if (view === "customer-booking" && currentUser?.role === "customer") {
    return <><CustomerBookingPage go={go} onToast={onToast} onSignOut={handleSignOut} user={currentUser} /><Toast message={toast} onClose={() => setToast("")} /></>;
  }
  if (view === "supplier-dashboard" && currentUser?.role === "supplier") {
    return <><SupplierPortal user={currentUser} onSignOut={handleSignOut} onToast={onToast} /><Toast message={toast} onClose={() => setToast("")} /></>;
  }

  if (!currentUser) return <><LoginPage go={go} onLogin={handleLogin} /><Toast message={toast} onClose={() => setToast("")} /></>;
  if (currentUser.role === "customer" || currentUser.role === "supplier") return <SessionLoading />;
  if (!canAccessView(view, currentUser.role) || canonicalView(view) !== view) return <SessionLoading />;

  return <><AppShell area={workspaceAreaForView(view, currentUser.role)} active={view} go={go} onToast={onToast} currentUser={currentUser} onSignOut={handleSignOut}><PageRouter view={view} go={go} onToast={onToast} currentUser={currentUser} /></AppShell><Toast message={toast} onClose={() => setToast("")} /></>;
}
