export function formatCurrency(amount: number) {
  return `₱${amount.toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function dateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function futureDateInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return dateInputValue(date);
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
