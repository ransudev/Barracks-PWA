import { AdminDashboard } from "@/app/pages/admin/AdminDashboard";
import { BarbersManagement } from "@/app/pages/admin/BarbersManagement";
import { AttendanceManagement } from "@/app/pages/admin/AttendanceManagement";
import { StaffManagement } from "@/app/pages/admin/StaffManagement";
import { SuppliersManagement } from "@/app/pages/admin/SuppliersManagement";
import { RestockManagement } from "@/app/pages/admin/RestockManagement";
import { ManagementReports } from "@/app/pages/admin/ManagementReports";
import { ServicesManagement } from "@/app/pages/admin/ServicesManagement";
import { InventoryPage } from "@/app/pages/staff/InventoryPage";
import { CustomersPage } from "@/app/pages/staff/CustomersPage";
import { StaffDashboard } from "@/app/pages/staff/StaffDashboard";
import { BookingsPage } from "@/app/pages/staff/BookingsPage";
import { QueuePage } from "@/app/pages/staff/QueuePage";
import { PaymentPage } from "@/app/pages/staff/PaymentPage";
import { BarberFloorPage } from "@/app/pages/staff/BarberFloorPage";
import { isManagementRole } from "@/app/constants/roles";
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
      return <AdminDashboard go={go} onToast={onToast} currentUser={currentUser} />;
    case "staff-management":
      return <StaffManagement onToast={onToast} currentUserId={currentUser.id} currentUserRole={currentUser.role} />;
    case "admin-suppliers":
      return <SuppliersManagement onToast={onToast} canManageLogins={currentUser.role === "administrator"} canDeactivate={currentUser.role === "administrator"} />;
    case "staff-suppliers":
      return <SuppliersManagement onToast={onToast} canManageLogins={currentUser.role === "administrator"} canDeactivate={currentUser.role === "administrator"} />;
    case "admin-restocks":
      return <RestockManagement onToast={onToast} />;
    case "restocks":
      return <RestockManagement onToast={onToast} />;
    case "admin-reports":
      return <ManagementReports onToast={onToast} />;
    case "admin-services":
      return <ServicesManagement onToast={onToast} />;
    case "admin-customers":
    case "customers":
      return <CustomersPage onToast={onToast} canDelete={currentUser.role === "administrator"} canManageLoyalty={isManagementRole(currentUser.role)} />;
    case "admin-barbers":
      return <BarbersManagement onToast={onToast} canDelete={currentUser.role === "administrator"} canEditCommission={isManagementRole(currentUser.role)} canSetAllCommissions={currentUser.role === "administrator"} />;
    case "admin-attendance":
      return <AttendanceManagement />;
    case "barbers":
      return <BarberFloorPage />;
    case "bookings":
      return <BookingsPage onToast={onToast} canOperate={currentUser.role === "front_desk"} canDelete={currentUser.role === "administrator"} />;
    case "queue":
      return <QueuePage onToast={onToast} canOperate={currentUser.role === "front_desk"} />;
    case "payments":
      return <PaymentPage onToast={onToast} canCheckout={currentUser.role === "front_desk"} canManageFinancialActions={isManagementRole(currentUser.role)} />;
    case "inventory":
    case "admin-inventory":
      return <InventoryPage admin={view === "admin-inventory"} onToast={onToast} canDelete={currentUser.role === "administrator"} />;
    case "staff-dashboard":
    default:
      return <StaffDashboard go={go} onToast={onToast} />;
  }
}
