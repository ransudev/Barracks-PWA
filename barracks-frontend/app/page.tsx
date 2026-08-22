"use client";

import { useCallback, useState } from "react";
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

export default function Home() {
  const [view, setView] = useState<ViewId>("landing");
  const [queue, setQueue] = usePersistentState<QueueEntry[]>(
    "barracks-queue",
    queueEntries,
  );
  const [stock, setStock] = usePersistentState<InventoryItem[]>(
    "barracks-inventory",
    inventory,
  );
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  function go(nextView: ViewId) {
    setView(nextView);
    setSearch("");

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const onToast = useCallback((message: string) => {
    setToast(message);

    if (typeof window !== "undefined") {
      window.setTimeout(() => setToast(""), 2800);
    }
  }, []);

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
        <LoginPage go={go} onToast={onToast} />
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
