"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/app/components/layout/AppShell";
import { LoginPage } from "@/app/pages/auth/LoginPage";
import { CustomerDashboard } from "@/app/pages/customer/CustomerDashboard";
import { CustomerBookingPage } from "@/app/pages/customer/CustomerBookingPage";
import { LandingPage } from "@/app/pages/public/LandingPage";
import { PageRouter } from "@/app/pages/PageRouter";
import { Toast } from "@/app/components/ui";
import type { ViewId } from "@/app/types/domain";
import { isAdminView, requiresAdministrator } from "@/app/utils/view";
import { isKnownAppPath, pathForView, viewForPath } from "@/app/utils/routes";
import {
  apiRequest,
  readApiBody,
  type ApiUser,
} from "@/app/lib/api";

const customerViews: ViewId[] = [
  "customer-dashboard",
  "customer-profile",
  "customer-booking",
];

function isCustomerView(view: ViewId): boolean {
  return customerViews.includes(view);
}

function isProtectedView(view: ViewId): boolean {
  return view !== "landing" && view !== "login";
}

function isWorkspaceView(view: ViewId): boolean {
  return isProtectedView(view) && !isCustomerView(view);
}

function defaultViewForUser(user: ApiUser): ViewId {
  if (user.role === "administrator") return "admin-dashboard";
  if (user.role === "customer") return "customer-dashboard";
  return "staff-dashboard";
}

function canAccessView(view: ViewId, user: ApiUser | null): boolean {
  if (!isProtectedView(view)) return true;
  if (!user) return false;
  if (isCustomerView(view)) return user.role === "customer";
  if (user.role === "customer") return false;
  return !requiresAdministrator(view) || user.role === "administrator";
}

function SessionLoading() {
  return (
    <main className="route-loading" aria-live="polite">
      <p className="eyebrow">Barracks</p>
      <h1>Restoring your workspace</h1>
      <p>Checking your account session…</p>
    </main>
  );
}

export function BarracksApp() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingView, setPendingView] = useState<ViewId | null>(null);
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [toast, setToast] = useState("");

  const onToast = useCallback((message: string) => {
    setToast(message);

    if (typeof window !== "undefined") {
      window.setTimeout(() => setToast(""), 2800);
    }
  }, []);

  function navigate(nextView: ViewId, replace = false) {
    const nextPath = pathForView(nextView);
    if (pathname === nextPath) return;
    if (replace) {
      router.replace(nextPath);
    } else {
      router.push(nextPath);
    }
  }

  const routeView = viewForPath(pathname);
  const view = pendingView && pathname === pathForView("login")
    ? "login"
    : routeView;

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const requestedView = viewForPath(pathname);
      setSessionLoading(true);

      try {
        const response = await apiRequest("/api/auth/me", { cache: "no-store" });
        const body = await readApiBody<{
          success: boolean;
          user?: ApiUser;
        }>(response);

        if (cancelled) return;

        if (response.ok && body?.success && body.user) {
          setCurrentUser(body.user);

          if (requestedView === "login" || !canAccessView(requestedView, body.user)) {
            const destination = defaultViewForUser(body.user);
            router.replace(pathForView(destination));
          }
        } else {
          setCurrentUser(null);
          if (isProtectedView(requestedView)) {
            setPendingView(requestedView);
            router.replace(pathForView("login"));
          }
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
          if (isProtectedView(requestedView)) {
            setPendingView(requestedView);
            router.replace(pathForView("login"));
          }
        }
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!isKnownAppPath(pathname)) {
    return null;
  }

  function go(nextView: ViewId) {
    if (isCustomerView(nextView) && (!currentUser || currentUser.role !== "customer")) {
      setPendingView(nextView);
      navigate("login");
      onToast("Sign in with a customer account to continue");
      return;
    }

    if (isWorkspaceView(nextView) && (!currentUser || currentUser.role === "customer")) {
      setPendingView(nextView);
      navigate("login");
      onToast("Sign in to access the workspace");
      return;
    }

    if (requiresAdministrator(nextView) && currentUser?.role !== "administrator") {
      onToast("Administrator access is required");
      return;
    }

    navigate(nextView);

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleLogin(user: ApiUser) {
    const destination = pendingView && canAccessView(pendingView, user)
      ? pendingView
      : defaultViewForUser(user);

    setCurrentUser(user);
    setPendingView(null);
    navigate(destination);
    onToast(`Signed in as ${user.firstName} ${user.lastName}`);
  }

  async function handleSignOut() {
    let message = "Signed out";

    try {
      const response = await apiRequest("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        throw new Error("Unable to sign out");
      }
    } catch (error) {
      message = error instanceof Error ? error.message : "Unable to sign out";
    } finally {
      setCurrentUser(null);
      setPendingView(null);
      router.replace(pathForView("landing"));
      onToast(message);
    }
  }

  if (sessionLoading && view !== "landing") {
    return <SessionLoading />;
  }

  if (view === "landing") {
    return (
      <>
        <LandingPage go={go} />
        <Toast message={toast} onClose={() => setToast("")} />
      </>
    );
  }

  if (view === "login" && currentUser) {
    return <SessionLoading />;
  }

  if (view === "login") {
    return (
      <>
        <LoginPage go={go} onToast={onToast} onLogin={handleLogin} />
        <Toast message={toast} onClose={() => setToast("")} />
      </>
    );
  }

  if ((view === "customer-dashboard" || view === "customer-profile") && currentUser?.role === "customer") {
    return (
      <>
        <CustomerDashboard go={go} onToast={onToast} onSignOut={handleSignOut} user={currentUser} />
        <Toast message={toast} onClose={() => setToast("")} />
      </>
    );
  }

  if (view === "customer-booking" && currentUser?.role === "customer") {
    return (
      <>
        <CustomerBookingPage go={go} onToast={onToast} onSignOut={handleSignOut} user={currentUser} />
        <Toast message={toast} onClose={() => setToast("")} />
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginPage go={go} onToast={onToast} onLogin={handleLogin} />
        <Toast message={toast} onClose={() => setToast("")} />
      </>
    );
  }

  const admin = currentUser.role === "administrator" && isAdminView(view);

  return (
    <>
      <AppShell
        area={admin ? "admin" : "staff"}
        active={view}
        go={go}
        onToast={onToast}
        currentUser={currentUser}
        onSignOut={handleSignOut}
      >
        <PageRouter
          view={view}
          go={go}
          onToast={onToast}
          currentUser={currentUser}
        />
      </AppShell>
      <Toast message={toast} onClose={() => setToast("")} />
    </>
  );
}
