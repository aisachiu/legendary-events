import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/app-url";

export const SLUG_MAX = 48;
const RESERVED_SLUGS = new Set(["new", "api"]);

export function slugifyBase(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, SLUG_MAX);
}

export function isValidSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length > 0 && slug.length <= SLUG_MAX;
}

export function parseEventSlug(raw: string) {
  const slug = slugifyBase(raw);
  if (!slug || RESERVED_SLUGS.has(slug) || !isValidSlug(slug)) return null;
  return slug;
}

export function publicEventUrl(slug: string) {
  return `${appOrigin()}/events/${slug}`;
}

export function previewEventPath(title: string, slugInput: string) {
  return parseEventSlug(slugInput) || slugifyBase(title) || "your-event";
}

/** Allocate a globally unique Channel.slug. excludeId is a Channel id. */
export async function allocateEventSlug(desired: string, excludeId?: string) {
  const base = slugifyBase(desired) || "event";
  let candidate = base;
  let n = 2;
  while (true) {
    const existing = await prisma.channel.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
    const suffix = `-${n}`;
    candidate = `${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
    n += 1;
  }
}

/** excludeId is a Channel id. */
export async function eventSlugTaken(slug: string, excludeId?: string) {
  const existing = await prisma.channel.findUnique({
    where: { slug },
    select: { id: true },
  });
  return Boolean(existing && existing.id !== excludeId);
}
