export const landingHours = {
  label: "Monday—Sunday / 9:00 AM—7:30 PM",
  timezone: "Philippine Standard Time",
};

export const landingContact = {
  phone: "+63 956 542 6212",
  localPhone: "0956 542 6212",
  email: "barracksdvo@gmail.com",
  instagram: "@barracksdvo",
};

export const landingServices = [
  {
    id: "haircut-grooming",
    number: "01",
    name: "Haircut & Grooming",
    description:
      "Consultation, haircut, shampoo + rinse, complimentary massage with hot towel, and grooming.",
    duration: "45 min",
    price: "₱300 / ₱400",
    priceNote: "Barber / Senior Barber",
    image:
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1200&q=85",
  },
  {
    id: "barracks-premium",
    number: "02",
    name: "Barracks Premium",
    description:
      "A more complete grooming experience involving a haircut plus shave or line-up. Ask about availability.",
    duration: "Up to 1 hr 15 min",
    price: "Confirm at booking",
    priceNote: "Select barber pricing",
    image:
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=85",
  },
  {
    id: "beard-shave",
    number: "03",
    name: "Straight Razor Shave / Beard Trim",
    description:
      "Traditional beard grooming and straight-razor or hot-towel shaving services where available.",
    duration: "Ask at booking",
    price: "Confirm at booking",
    priceNote: "Branch availability",
    image:
      "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=85",
  },
];

export const landingEditorialImages = {
  tools:
    "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=85",
  detail:
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=85",
  collageDetail:
    "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1200&q=85",
  studio:
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=85",
};

export const landingBarberImages: Record<string, string> = {
  rodsky:
    "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=1000&q=85",
  ernie:
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1000&q=85",
  judy:
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1000&q=85",
  kent:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1000&q=85",
};

export const landingBarbers = [
  { id: "rodsky", name: "Rodsky", role: "Barber", branch: "Bajada HQ", price: "₱300", dayOff: "Tuesday" },
  { id: "ernie", name: "Ernie", role: "Senior Barber", branch: "Bajada HQ", price: "₱400", dayOff: "Friday" },
  { id: "ronnie", name: "Ronnie", role: "Senior Barber", branch: "Bajada HQ", price: "₱400", dayOff: "Wednesday" },
  { id: "tope", name: "Tope", role: "Barber", branch: "Bajada HQ", price: "₱300", dayOff: "Thursday" },
  { id: "judy", name: "Judy", role: "Senior Barber", branch: "Lanang HQ", price: "₱400", dayOff: "Friday" },
  { id: "elizer", name: "Elizer", role: "Senior Barber", branch: "Lanang HQ", price: "₱400", dayOff: "Thursday" },
  { id: "deo", name: "Deo", role: "Barber", branch: "Lanang HQ", price: "₱300", dayOff: "Monday" },
  { id: "jorlan", name: "Jorlan", role: "Barber", branch: "Lanang HQ", price: "₱300", dayOff: "Tuesday" },
  { id: "jun", name: "Jun", role: "Barber", branch: "Bangkal HQ", price: "₱300", dayOff: "Friday" },
  { id: "kent", name: "Kent", role: "Senior Barber", branch: "Bangkal HQ", price: "₱400", dayOff: "Wednesday" },
  { id: "arth", name: "Arth", role: "Senior Barber", branch: "Bangkal HQ", price: "₱400", dayOff: "Tuesday" },
  { id: "marcus", name: "Marcus", role: "Barber", branch: "Bangkal HQ", price: "₱300", dayOff: "Thursday" },
  { id: "aries", name: "Aries", role: "Senior Barber", branch: "Maa HQ", price: "₱400", dayOff: "Monday" },
  { id: "rex", name: "Rex", role: "Senior Barber", branch: "Maa HQ", price: "₱400", dayOff: "Thursday" },
  { id: "gemrick", name: "Gemrick", role: "Senior Barber", branch: "Maa HQ", price: "₱400", dayOff: "Tuesday" },
  { id: "el", name: "El", role: "Senior Barber", branch: "Maa HQ", price: "₱400", dayOff: "Wednesday" },
];

export const landingBranches = [
  {
    id: "bajada",
    name: "Barracks Bajada HQ",
    address: "Surveyor St., Doña Vicenta Village, 19-B, Bajada, Davao City",
    landmark: "Established main location",
    barbers: "Rodsky, Ernie, Ronnie, Tope",
  },
  {
    id: "lanang",
    name: "Barracks Lanang HQ",
    address: "Unit 5, RNC Building, J.P. Laurel Avenue, Davao City",
    landmark: "Fronting BYD Motors",
    barbers: "Judy, Elizer, Deo, Jorlan",
  },
  {
    id: "bangkal",
    name: "Barracks Bangkal HQ",
    address: "Door 3 & 4, DBR Building, McArthur Highway corner Pag-asa Avenue, Davao City",
    landmark: "Fronting Sam Surplus",
    barbers: "Jun, Kent, Arth, Marcus",
  },
  {
    id: "maa",
    name: "Barracks Maa HQ",
    address: "Unit 1, LiMaria Building, Maa Road, Davao City",
    landmark: "Fronting UM Maa Gate",
    barbers: "Aries, Rex, Gemrick, El",
  },
];
