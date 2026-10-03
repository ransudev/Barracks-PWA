export type ManagementDashboardData = {
  inventoryValue: number;
  openRestocks: number;
  todayBookings: number;
  upcomingBookings: number;
  activeBarbers: number;
  customerCount: number;
  lowStock: { id: number; name: string; supplierName: string | null; category: string; quantity: number; minimumStock: number; unit: string }[];
  recentDeliveries: { id: number; supplier_name: string; reference: string | null; received_at: string | null }[];
};
