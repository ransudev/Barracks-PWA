import type { Dispatch, SetStateAction } from "react";
import { AdminDashboard } from "@/app/pages/admin/AdminDashboard";
import { BarbersManagement } from "@/app/pages/admin/BarbersManagement";
import { ReportsPage } from "@/app/pages/admin/ReportsPage";
import { ServicesManagement } from "@/app/pages/admin/ServicesManagement";
import { StaffManagement } from "@/app/pages/admin/StaffManagement";
import { AdminSettings } from "@/app/pages/admin/SettingsPage";
import { BookingsPage } from "@/app/pages/staff/BookingsPage";
import { CustomersPage } from "@/app/pages/staff/CustomersPage";
import { InventoryPage } from "@/app/pages/staff/InventoryPage";
import { PaymentPage } from "@/app/pages/staff/PaymentPage";
import { QueuePage } from "@/app/pages/staff/QueuePage";
import { StaffDashboard } from "@/app/pages/staff/StaffDashboard";
import { StaffSettingsPage } from "@/app/pages/staff/SettingsPage";
import type { InventoryItem, QueueEntry, ViewId } from "@/app/types/domain";

type PageRouterProps = {
  view: ViewId;
  go: (view: ViewId) => void;
  queue: QueueEntry[];
  setQueue: Dispatch<SetStateAction<QueueEntry[]>>;
  stock: InventoryItem[];
  setStock: Dispatch<SetStateAction<InventoryItem[]>>;
  onToast: (message: string) => void;
};

export function PageRouter({
  view,
  go,
  queue,
  setQueue,
  stock,
  setStock,
  onToast,
}: PageRouterProps) {
  switch (view) {
    case "queue":
      return <QueuePage queue={queue} setQueue={setQueue} onToast={onToast} />;
    case "bookings":
      return <BookingsPage onToast={onToast} />;
    case "customers":
      return <CustomersPage onToast={onToast} />;
    case "payment":
      return <PaymentPage onToast={onToast} />;
    case "inventory":
      return (
        <InventoryPage items={stock} setItems={setStock} onToast={onToast} />
      );
    case "staff-settings":
      return <StaffSettingsPage go={go} onToast={onToast} />;
    case "admin-dashboard":
      return <AdminDashboard go={go} onToast={onToast} />;
    case "staff-management":
      return <StaffManagement onToast={onToast} />;
    case "barbers":
      return <BarbersManagement onToast={onToast} />;
    case "services":
      return <ServicesManagement onToast={onToast} />;
    case "reports":
      return <ReportsPage onToast={onToast} />;
    case "admin-inventory":
      return (
        <InventoryPage
          items={stock}
          setItems={setStock}
          onToast={onToast}
          admin
        />
      );
    case "admin-settings":
      return <AdminSettings onToast={onToast} />;
    default:
      return <StaffDashboard go={go} />;
  }
}
