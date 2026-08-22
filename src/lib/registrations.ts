export const OCCUPYING_STATUSES = ["CONFIRMED", "PENDING_PAYMENT"] as const;
export const HELD_STATUSES = ["CONFIRMED", "PENDING_PAYMENT", "WAITLISTED"] as const;

export function occupyingSpotWhere(eventId: string, excludeRegistrationId?: string) {
  return {
    status: { in: [...OCCUPYING_STATUSES] },
    registration: {
      eventId,
      ...(excludeRegistrationId ? { id: { not: excludeRegistrationId } } : {}),
    },
  };
}

export function isHeldStatus(status: string) {
  return (HELD_STATUSES as readonly string[]).includes(status);
}

export function formatSignupCount(occupying: number, capacity: number | null) {
  if (capacity == null) return `${occupying} signed up`;
  return occupying >= capacity
    ? `${occupying} / ${capacity} signed up · Full`
    : `${occupying} / ${capacity} signed up`;
}

export function eventIsFull(occupying: number, capacity: number | null) {
  return capacity != null && occupying >= capacity;
}

export function remainingSeats(capacity: number | null, occupyingOthers: number) {
  if (capacity == null) return Infinity;
  return Math.max(0, capacity - occupyingOthers);
}

export function bookingStatusFromSpots(spots: { status: string }[]) {
  const active = spots.filter((s) => s.status !== "CANCELLED");
  if (active.length === 0) return "CANCELLED";
  if (active.every((s) => s.status === "WAITLISTED")) return "WAITLISTED";
  if (active.every((s) => s.status === "CONFIRMED")) return "CONFIRMED";
  if (active.some((s) => s.status === "PENDING_PAYMENT")) return "PENDING_PAYMENT";
  if (active.some((s) => s.status === "CONFIRMED")) return "PENDING_PAYMENT";
  return active[0]?.status ?? "CANCELLED";
}

export function parseGuestNames(formData: FormData, fallbackHolder: string) {
  const holder =
    String(formData.get("preferredName") || formData.get("holderName") || "").trim() ||
    fallbackHolder;
  const extras = formData
    .getAll("guestName")
    .map((v) => String(v).trim())
    .filter(Boolean);
  return { holder, extras };
}

export function parseShowOnGoing(formData: FormData, partySize: number) {
  const flags = formData.getAll("showOnGoing").map((v) => v === "1" || v === "on");
  return Array.from({ length: partySize }, (_, i) => flags[i] ?? true);
}
