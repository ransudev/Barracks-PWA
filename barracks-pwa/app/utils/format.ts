export function formatCurrency(amount: number) {
  return `₱${amount.toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function dateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function futureDateInputValue() {
  return dateInputValue(new Date(Date.now() + 86_400_000));
}

export function createInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function createSlug(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}
