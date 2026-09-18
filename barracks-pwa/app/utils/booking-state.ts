export type BookingListState = "loading" | "error" | "list" | "empty";

export function bookingListState(input: {
  loading: boolean;
  loadError: string;
  visibleCount: number;
}): BookingListState {
  if (input.loading) return "loading";
  if (input.loadError) return "error";
  return input.visibleCount > 0 ? "list" : "empty";
}

