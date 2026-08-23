export function formatMoney(cents: number, currency = "usd") {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(cents / 100);
  } catch {
    return `${code} ${(cents / 100).toFixed(2)}`;
  }
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
  WAITLISTED: "Waitlist",
  CANCELLED: "Cancelled",
};

export const paymentLabel: Record<string, string> = {
  UNPAID: "Unpaid",
  AWAITING_REVIEW: "Evidence submitted",
  PAID: "Paid",
  REJECTED: "Rejected",
  REFUNDED: "Refunded",
};
