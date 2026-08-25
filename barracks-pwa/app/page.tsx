"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/app/components/layout/AppShell";
import { LoginPage } from "@/app/pages/auth/LoginPage";
import { CustomerProfile } from "@/app/pages/customer/CustomerProfile";
import { LandingPage } from "@/app/pages/public/LandingPage";
import { PageRouter } from "@/app/pages/PageRouter";
import { Toast } from "@/app/components/ui";
import { inventory } from "@/app/data/inventory";
import { queueEntries } from "@/app/data/queue";
import { isAdminView } from "@/app/utils/view";
import { usePersistentState } from "@/app/hooks/usePersistentState";
import type { InventoryItem, QueueEntry, ViewId } from "@/app/types/domain";
import {
  apiRequest,
  readApiBody,
  type ApiUser,
} from "@/app/lib/api";

export default function Home() {
  const [view, setView] = useState<ViewId>("landing");
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [queue, setQueue] = usePersistentState<QueueEntry[]>(
    "barracks-queue-v2",
    queueEntries,
  );
  const [stock, setStock] = usePersistentState<InventoryItem[]>(
    "barracks-inventory-v2",
    inventory,
  );
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
    const isWorkspaceView = !["landing", "login", "customer"].includes(nextView);

    if (isWorkspaceView && !currentUser) {
      setView("login");
      setSearch("");
      onToast("Sign in to access the workspace");
      return;
    }

    if (isAdminView(nextView) && currentUser?.role !== "administrator") {
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
    setView(user.role === "administrator" ? "admin-dashboard" : "staff-dashboard");
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

  if (view === "customer") {
    return (
      <>
        <CustomerProfile go={go} onToast={onToast} />
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

  const admin = isAdminView(view);

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
          queue={queue}
          setQueue={setQueue}
          stock={stock}
          setStock={setStock}
          onToast={onToast}
        />
      </AppShell>
      <Toast message={toast} onClose={() => setToast("")} />
    </>
  );
}
