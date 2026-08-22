export function isPlaceholderName(
  name: string,
  email?: string | null,
  phone?: string | null,
) {
  const n = name.trim();
  if (!n || /^guest$/i.test(n)) return true;
  if (/^\+?\d{6,}$/.test(n)) return true;
  if (phone && (n === phone || n === phone.replace(/\D/g, ""))) return true;
  if (email?.endsWith("@phone.legendary.events")) {
    const local = email.split("@")[0];
    if (n === local) return true;
  }
  if (email) {
    const local = email.split("@")[0];
    if (n === local && local.includes(".")) return false;
    if (n === local) return true;
  }
  return false;
}
