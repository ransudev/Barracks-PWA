import type { Service } from "@/app/types/domain";

export const services: Service[] = [
  {
    id: "barracks-basic",
    name: "Barracks Basic",
    description: "A clean, tailored cut finished to your preference.",
    durationMinutes: 45,
    price: 300,
    active: true,
  },
  {
    id: "signature-shave",
    name: "Signature Shave",
    description: "A close shave with a warm towel finish.",
    durationMinutes: 30,
    price: 300,
    active: true,
  },
  {
    id: "barracks-premium",
    name: "Barracks Premium",
    description: "A complete cut, styling, and premium finish.",
    durationMinutes: 75,
    price: 550,
    active: true,
  },
];
