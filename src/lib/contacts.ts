/** Placeholder emails for SMS-only Descope users until they link a real inbox. */
export const PHONE_EMAIL_DOMAIN = "phone.legendary.events";

export function isRealEmail(email?: string | null) {
  return Boolean(
    email && email.includes("@") && !email.toLowerCase().endsWith(`@${PHONE_EMAIL_DOMAIN}`),
  );
}

export type BookerContact = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** Registration / booker status used for audience filters. */
  status: string;
};

export type ReachableContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  channel: "email" | "phone";
};

export type ContactBuckets = {
  emailable: ReachableContact[];
  phoneOnly: ReachableContact[];
  unreachable: { id: string; name: string }[];
};

export type ContactAudience = "coming" | "reserved" | "waitlist" | "all";

export function matchesAudience(status: string, audience: ContactAudience) {
  switch (audience) {
    case "coming":
      return status === "CONFIRMED";
    case "reserved":
      return status === "PENDING_PAYMENT";
    case "waitlist":
      return status === "WAITLISTED";
    case "all":
      return status !== "CANCELLED";
  }
}

/** Prefer a real email; otherwise phone. Placeholder emails are not contactable. */
export function resolveContact(booker: BookerContact): ReachableContact | { id: string; name: string; channel: "none" } {
  if (isRealEmail(booker.email)) {
    return {
      id: booker.id,
      name: booker.name,
      email: booker.email,
      phone: booker.phone,
      channel: "email",
    };
  }
  if (booker.phone) {
    return {
      id: booker.id,
      name: booker.name,
      email: null,
      phone: booker.phone,
      channel: "phone",
    };
  }
  return { id: booker.id, name: booker.name, channel: "none" };
}

export function partitionContacts(bookers: BookerContact[], audience: ContactAudience): ContactBuckets {
  const emailable: ReachableContact[] = [];
  const phoneOnly: ReachableContact[] = [];
  const unreachable: { id: string; name: string }[] = [];

  for (const booker of bookers) {
    if (!matchesAudience(booker.status, audience)) continue;
    const resolved = resolveContact(booker);
    if (resolved.channel === "email") emailable.push(resolved);
    else if (resolved.channel === "phone") phoneOnly.push(resolved);
    else unreachable.push({ id: resolved.id, name: resolved.name });
  }

  return { emailable, phoneOnly, unreachable };
}

/** Display label for a booker on host UIs — hide placeholder emails. */
export function displayContactLine(user: { email: string; phone: string | null }) {
  if (isRealEmail(user.email)) return user.email;
  if (user.phone) return user.phone;
  return "No email or phone on file";
}

const MAILTO_SAFE_LENGTH = 1800;

export function buildMailtoBcc(emails: string[], subject: string) {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (unique.length === 0) return null;

  const params = new URLSearchParams();
  params.set("bcc", unique.join(","));
  if (subject.trim()) params.set("subject", subject.trim());

  const href = `mailto:?${params.toString()}`;
  if (href.length > MAILTO_SAFE_LENGTH) {
    return { href: null as string | null, emails: unique, tooLong: true as const };
  }
  return { href, emails: unique, tooLong: false as const };
}

export function phonesForCopy(phones: string[]) {
  return [...new Set(phones.map((p) => p.trim()).filter(Boolean))].join("\n");
}

export function emailsForCopy(emails: string[]) {
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))].join("\n");
}

export function smsHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `sms:${digits}` : null;
}
