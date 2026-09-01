import { AdminDashboard } from "@/app/pages/admin/AdminDashboard";
import { BarbersManagement } from "@/app/pages/admin/BarbersManagement";
import { StaffManagement } from "@/app/pages/admin/StaffManagement";
import { InventoryPage } from "@/app/pages/staff/InventoryPage";
import { CustomersPage } from "@/app/pages/staff/CustomersPage";
import { StaffDashboard } from "@/app/pages/staff/StaffDashboard";
import { BookingsPage } from "@/app/pages/staff/BookingsPage";
import type { ApiUser } from "@/app/lib/api";
import type { ViewId } from "@/app/types/domain";

type PageRouterProps = {
  view: ViewId;
  go: (view: ViewId) => void;
  onToast: (message: string) => void;
  currentUser: ApiUser;
};

export function PageRouter({ view, go, onToast, currentUser }: PageRouterProps) {
  switch (view) {
    case "admin-dashboard":
      return <AdminDashboard go={go} onToast={onToast} />;
    case "staff-management":
      return <StaffManagement onToast={onToast} />;
    case "admin-customers":
    case "customers":
      return <CustomersPage onToast={onToast} canDelete={currentUser.role === "administrator"} />;
    case "admin-barbers":
    case "barbers":
      return <BarbersManagement onToast={onToast} canDelete={currentUser.role === "administrator"} />;
    case "bookings":
      return <BookingsPage onToast={onToast} />;
    case "inventory":
    case "admin-inventory":
      return <InventoryPage admin={view === "admin-inventory"} onToast={onToast} canDelete={currentUser.role === "administrator"} />;
    case "staff-dashboard":
    default:
      return <StaffDashboard go={go} onToast={onToast} />;
  }
}
