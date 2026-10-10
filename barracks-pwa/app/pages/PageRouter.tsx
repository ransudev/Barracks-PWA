"use client";

import dynamic from "next/dynamic";
import { ScreenLoading } from "@/app/components/ui/ScreenLoading";
import { isManagementRole } from "@/app/constants/roles";
import type { ApiUser } from "@/app/lib/api";
import type { ViewId } from "@/app/types/domain";

const BranchesManagement = dynamic(() => import("@/app/pages/admin/BranchesManagement").then((module) => module.BranchesManagement), { loading: ScreenLoading });
const PayrollManagement = dynamic(() => import("@/app/pages/admin/PayrollManagement").then((module) => module.PayrollManagement), { loading: ScreenLoading });
const AdminDashboard = dynamic(() => import("@/app/pages/admin/AdminDashboard").then((module) => module.AdminDashboard), { loading: ScreenLoading });
const BarbersManagement = dynamic(() => import("@/app/pages/admin/BarbersManagement").then((module) => module.BarbersManagement), { loading: ScreenLoading });
const AttendanceManagement = dynamic(() => import("@/app/pages/admin/AttendanceManagement").then((module) => module.AttendanceManagement), { loading: ScreenLoading });
const StaffManagement = dynamic(() => import("@/app/pages/admin/StaffManagement").then((module) => module.StaffManagement), { loading: ScreenLoading });
const SuppliersManagement = dynamic(() => import("@/app/pages/admin/SuppliersManagement").then((module) => module.SuppliersManagement), { loading: ScreenLoading });
const RestockManagement = dynamic(() => import("@/app/pages/admin/RestockManagement").then((module) => module.RestockManagement), { loading: ScreenLoading });
const ManagementReports = dynamic(() => import("@/app/pages/admin/ManagementReports").then((module) => module.ManagementReports), { loading: ScreenLoading });
const ServicesManagement = dynamic(() => import("@/app/pages/admin/ServicesManagement").then((module) => module.ServicesManagement), { loading: ScreenLoading });
const InventoryPage = dynamic(() => import("@/app/pages/staff/InventoryPage").then((module) => module.InventoryPage), { loading: ScreenLoading });
const CustomersPage = dynamic(() => import("@/app/pages/staff/CustomersPage").then((module) => module.CustomersPage), { loading: ScreenLoading });
const StaffDashboard = dynamic(() => import("@/app/pages/staff/StaffDashboard").then((module) => module.StaffDashboard), { loading: ScreenLoading });
const BookingsPage = dynamic(() => import("@/app/pages/staff/BookingsPage").then((module) => module.BookingsPage), { loading: ScreenLoading });
const QueuePage = dynamic(() => import("@/app/pages/staff/QueuePage").then((module) => module.QueuePage), { loading: ScreenLoading });
const PaymentPage = dynamic(() => import("@/app/pages/staff/PaymentPage").then((module) => module.PaymentPage), { loading: ScreenLoading });
const BarberFloorPage = dynamic(() => import("@/app/pages/staff/BarberFloorPage").then((module) => module.BarberFloorPage), { loading: ScreenLoading });

type PageRouterProps = {
  view: ViewId;
  go: (view: ViewId) => void;
  onToast: (message: string) => void;
  currentUser: ApiUser;
};

export function PageRouter({ view, go, onToast, currentUser }: PageRouterProps) {
  switch (view) {
    case "admin-payroll":
      return <PayrollManagement currentUserRole={currentUser.role} onToast={onToast} />;
    case "admin-branches":
      return <BranchesManagement currentUserRole={currentUser.role} onToast={onToast} />;
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
      return <ManagementReports globalAllowed={currentUser.role === "administrator"} onToast={onToast} />;
    case "admin-services":
      return <ServicesManagement onToast={onToast} />;
    case "admin-customers":
    case "customers":
      return <CustomersPage onToast={onToast} canDelete={currentUser.role === "administrator"} canManageLoyalty={isManagementRole(currentUser.role)} />;
    case "admin-barbers":
      return <BarbersManagement onToast={onToast} canDelete={currentUser.role === "administrator"} canEditCommission={currentUser.role === "administrator"} canSetAllCommissions={currentUser.role === "administrator"} />;
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
