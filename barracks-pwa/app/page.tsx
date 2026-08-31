"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/app/components/layout/AppShell";
import { LoginPage } from "@/app/pages/auth/LoginPage";
import { CustomerDashboard } from "@/app/pages/customer/CustomerDashboard";
import { CustomerBookingPage } from "@/app/pages/customer/CustomerBookingPage";
import { LandingPage } from "@/app/pages/public/LandingPage";
import { PageRouter } from "@/app/pages/PageRouter";
import { Toast } from "@/app/components/ui";
import type { ViewId } from "@/app/types/domain";
import { isAdminView, requiresAdministrator } from "@/app/utils/view";
import {
  apiRequest,
  readApiBody,
  type ApiUser,
} from "@/app/lib/api";

export default function Home() {
  const [view, setView] = useState<ViewId>("landing");
  const [pendingView, setPendingView] = useState<ViewId | null>(null);
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  const onToast = useCallback((message: string) => {
    setToast(message);

    if (typeof window !== "undefined") {
      window.setTimeout(() => setToast(""), 2800);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await apiRequest("/api/auth/me");
        const body = await readApiBody<{
          success: boolean;
          user?: ApiUser;
        }>(response);

        if (!cancelled && response.ok && body?.success && body.user) {
          setCurrentUser(body.user);
        }
      } catch {
        // The public landing page remains usable when the database is unavailable.
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  function go(nextView: ViewId) {
    const isCustomerView = ["customer-dashboard", "customer-profile", "customer-booking"].includes(nextView);
    const isWorkspaceView = !["landing", "login", "customer-dashboard", "customer-profile", "customer-booking"].includes(nextView);

    if (isCustomerView && (!currentUser || currentUser.role !== "customer")) {
      setPendingView(nextView);
      setView("login");
      setSearch("");
      onToast("Sign in with a customer account to continue");
      return;
    }

    if (isWorkspaceView && (!currentUser || currentUser.role === "customer")) {
      setPendingView(nextView);
      setView("login");
      setSearch("");
      onToast("Sign in to access the workspace");
      return;
    }

    if (requiresAdministrator(nextView) && currentUser?.role !== "administrator") {
      onToast("Administrator access is required");
      return;
    }

    setView(nextView);
    setSearch("");

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleLogin(user: ApiUser) {
    setCurrentUser(user);
    setSearch("");
    setView(pendingView && ((user.role === "customer" && ["customer-dashboard", "customer-profile", "customer-booking"].includes(pendingView)) || (user.role !== "customer" && !["customer-dashboard", "customer-profile", "customer-booking"].includes(pendingView))) ? pendingView : user.role === "administrator" ? "admin-dashboard" : user.role === "customer" ? "customer-dashboard" : "staff-dashboard");
    setPendingView(null);
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
      setView("landing");
      setPendingView(null);
      setSearch("");
      onToast(message);
    }
  }

  if (view === "landing") {
    return (
      <>
        <LandingPage go={go} />
        <Toast message={toast} onClose={() => setToast("")} />
      </>
    );
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
        search={search}
        setSearch={setSearch}
        onToast={onToast}
        currentUser={currentUser}
        onSignOut={handleSignOut}
      >
        <PageRouter
          view={view}
          go={go}
          onToast={onToast}
        />
      </AppShell>
      <Toast message={toast} onClose={() => setToast("")} />
    </>
  );
}
