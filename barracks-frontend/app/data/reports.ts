import type { RevenueByService, RevenueDay } from "@/app/types/domain";

export const revenueByDay: RevenueDay[] = [
  { day: "Mon", value: 425 },
  { day: "Tue", value: 580 },
  { day: "Wed", value: 310 },
  { day: "Thu", value: 395 },
  { day: "Fri", value: 145 },
  { day: "Sat", value: 630 },
  { day: "Sun", value: 0 },
];

export const revenueByService: RevenueByService[] = [
  { label: "Haircut", value: 4250, percent: 34, tone: "blue" },
  { label: "Full Service", value: 3100, percent: 25, tone: "green" },
  { label: "Haircut + Color", value: 2550, percent: 20, tone: "violet" },
  { label: "Beard Services", value: 1685, percent: 14, tone: "amber" },
  { label: "Other", value: 900, percent: 7, tone: "slate" },
];

export const topCustomerValues = [540, 480, 380, 280, 225];
