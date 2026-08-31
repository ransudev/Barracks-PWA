import { AdminDashboard } from "@/app/pages/admin/AdminDashboard";
import { BarberProfile } from "@/app/pages/admin/BarberProfile";
import { BarbersManagement } from "@/app/pages/admin/BarbersManagement";
import { StaffManagement } from "@/app/pages/admin/StaffManagement";
import { InventoryPage } from "@/app/pages/staff/InventoryPage";
import { CustomersPage } from "@/app/pages/staff/CustomersPage";
import { StaffDashboard } from "@/app/pages/staff/StaffDashboard";
import { BookingsPage } from "@/app/pages/staff/BookingsPage";
import type { ViewId } from "@/app/types/domain";

type PageRouterProps = {
  view: ViewId;
  go: (view: ViewId) => void;
  onToast: (message: string) => void;
};

export function PageRouter({ view, go, onToast }: PageRouterProps) {
  switch (view) {
    case "admin-dashboard":
      return <AdminDashboard go={go} onToast={onToast} />;
    case "staff-management":
      return <StaffManagement onToast={onToast} />;
    case "barbers":
      return <BarbersManagement go={go} onToast={onToast} />;
    case "barber-profile":
      return <BarberProfile go={go} onToast={onToast} />;
    case "customers":
      return <CustomersPage onToast={onToast} />;
    case "bookings":
      return <BookingsPage onToast={onToast} />;
    case "inventory":
    case "admin-inventory":
      return <InventoryPage admin={view === "admin-inventory"} onToast={onToast} />;
    case "staff-dashboard":
    default:
      return <StaffDashboard go={go} onToast={onToast} />;
  }
}
