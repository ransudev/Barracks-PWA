import type { Service } from "@/app/types/domain";

export const services: Service[] = [
  {
    id: "barracks-basic",
    name: "Barracks Basic",
    description: "A clean, tailored cut finished to your preference.",
    duration: "45 mins",
    price: 300,
    active: true,
  },
  {
    id: "signature-shave",
    name: "Signature Shave",
    description: "A close shave with a warm towel finish.",
    duration: "30 mins",
    price: 300,
    active: true,
  },
  {
    id: "barracks-premium",
    name: "Barracks Premium",
    description: "A complete cut, styling, and finishing ritual.",
    duration: "75 mins",
    price: 550,
    active: true,
  },
];
