/** True when `name` looks auto-generated (email local-part, phone digits, Guest, …). */
export function isPlaceholderName(
  name: string,
  email?: string | null,
  phone?: string | null,
) {
  const n = name.trim();
  if (!n || /^guest$/i.test(n)) return true;
  if (/^\+?\d{6,}$/.test(n)) return true;
  if (phone && (n === phone || n === phone.replace(/\D/g, ""))) return true;
  if (email) {
    const local = email.split("@")[0];
    if (n === local) return true;
    if (email.endsWith("@phone.legendary.events") && n === local) return true;
  }
  return false;
}

const PENDING_NAME_KEY = "legendary-events-pending-name";

/** Stash a display name while the user waits for a magic link (same browser). */
export function savePendingName(name: string) {
  if (typeof window === "undefined") return;
  const n = name.trim();
  if (n.length >= 2) sessionStorage.setItem(PENDING_NAME_KEY, n);
  else sessionStorage.removeItem(PENDING_NAME_KEY);
}

/** Read and clear any name collected before the magic-link click. */
export function takePendingName() {
  if (typeof window === "undefined") return undefined;
  const n = sessionStorage.getItem(PENDING_NAME_KEY)?.trim() || "";
  sessionStorage.removeItem(PENDING_NAME_KEY);
  return n.length >= 2 ? n : undefined;
}
