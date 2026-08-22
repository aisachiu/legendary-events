export const OCCUPYING_STATUSES = ["CONFIRMED", "PENDING_PAYMENT"] as const;
export const HELD_STATUSES = ["CONFIRMED", "PENDING_PAYMENT", "WAITLISTED"] as const;

export function occupyingWhere(eventId: string, excludeUserId?: string) {
  return {
    eventId,
    status: { in: [...OCCUPYING_STATUSES] },
    ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
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
