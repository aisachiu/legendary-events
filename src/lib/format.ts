export function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function formatWhen(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function slugify(input: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  return `${base || "event"}-${Math.random().toString(36).slice(2, 7)}`;
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const registrationLabel: Record<string, string> = {
  PENDING_PAYMENT: "Payment needed",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

export const paymentLabel: Record<string, string> = {
  UNPAID: "Unpaid",
  AWAITING_REVIEW: "Evidence submitted",
  PAID: "Paid",
  REJECTED: "Rejected",
  REFUNDED: "Refunded",
};
