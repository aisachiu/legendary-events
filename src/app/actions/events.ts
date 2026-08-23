"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { parseCapacityFromForm, parseCurrencyFromForm } from "@/lib/currency";
import { sanitizeEventHtml, stripHtml } from "@/lib/event-html";
import { prisma } from "@/lib/prisma";
import { canHost, canManageEvent, isSuperadmin } from "@/lib/roles";
import { allocateEventSlug, eventSlugTaken, parseEventSlug } from "@/lib/slugs";
import { eventBlurb } from "@/lib/storage";
import { isThemeId } from "@/lib/themes";

async function requireHost() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  if (!canHost(user)) {
    redirect("/dashboard?error=host");
  }
  return user;
}

function parseDescription(formData: FormData, fallback = "") {
  const raw = String(formData.get("description") || fallback);
  return sanitizeEventHtml(raw);
}

function parseThemeId(formData: FormData): string | null | undefined {
  if (!formData.has("themeId")) return undefined;
  const raw = String(formData.get("themeId") || "").trim();
  if (!raw || raw === "inherit") return null;
  return isThemeId(raw) ? raw : null;
}

function parseContactDetails(formData: FormData) {
  return String(formData.get("contactDetails") || "").trim() || null;
}

function parsePaymentInstructions(formData: FormData, fallback = "") {
  const html = sanitizeEventHtml(String(formData.get("paymentInstructions") || fallback));
  return stripHtml(html) ? html : null;
}

function failCreate(error: string): never {
  redirect(`/dashboard/events/new?error=${error}`);
}

function failUpdate(id: string, error: string, next: string, user: { role: string }): never {
  if (next.startsWith("/admin") && isSuperadmin(user)) {
    redirect(`${next}${next.includes("?") ? "&" : "?"}error=${error}`);
  }
  redirect(`/dashboard/events/${id}?error=${error}`);
}

async function resolveCustomSlug(raw: string, excludeId?: string) {
  const slug = parseEventSlug(raw);
  if (!slug) return null;
  if (await eventSlugTaken(slug, excludeId)) return null;
  return slug;
}

export async function createEventAction(formData: FormData) {
  const user = await requireHost();
  const title = String(formData.get("title") || "").trim();
  const description = parseDescription(formData);
  const venue = String(formData.get("venue") || "").trim();
  const startsAt = String(formData.get("startsAt") || "");
  const endsAt = String(formData.get("endsAt") || "");
  const isNetworking = formData.get("isNetworking") === "on";
  const isPaid = formData.get("isPaid") === "on";
  const price = Number(formData.get("price") || 0);
  const paymentInstructions = parsePaymentInstructions(formData);
  const currency = isPaid ? parseCurrencyFromForm(formData) : "hkd";
  const capacity = parseCapacityFromForm(formData);
  const maxPerOrder = Math.max(1, Math.floor(Number(formData.get("maxPerOrder") || 1)));

  if (!title || !stripHtml(description) || !venue || !startsAt) {
    failCreate("missing");
  }

  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const priceCents = isPaid ? Math.round(price * 100) : 0;
  if (isPaid && priceCents < 100) {
    failCreate("price");
  }

  const slugRaw = String(formData.get("slug") || "").trim();
  const slug = slugRaw ? await resolveCustomSlug(slugRaw) : await allocateEventSlug(title);
  if (!slug) failCreate("slug");

  let event;
  try {
    event = await prisma.event.create({
      data: {
        slug,
        title,
        summary: eventBlurb(description),
        description,
        venue,
        startsAt: start,
        endsAt: end,
        isNetworking,
        isPaid,
        priceCents,
        currency,
        capacity,
        maxPerOrder,
        allowOfflinePayment: isPaid,
        paymentInstructions: isPaid ? paymentInstructions : null,
        themeId: parseThemeId(formData) ?? null,
        contactDetails: parseContactDetails(formData),
        organizerId: user.id,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      failCreate("slug");
    }
    throw error;
  }

  redirect(`/dashboard/events/${event.id}`);
}

export async function updateEventAction(formData: FormData) {
  const user = await requireHost();
  const id = String(formData.get("id") || "");
  const next = String(formData.get("next") || "");
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || !canManageEvent(user, event.organizerId)) redirect("/dashboard");

  const isPaid = formData.get("isPaid") === "on";
  const description = parseDescription(formData, event.description);
  const priceCents = isPaid ? Math.round(Number(formData.get("price") || 0) * 100) : 0;

  const slugRaw = String(formData.get("slug") || "").trim();
  let slug = event.slug;
  if (formData.has("slug")) {
    if (slugRaw) {
      const nextSlug = await resolveCustomSlug(slugRaw, event.id);
      if (!nextSlug) failUpdate(id, "slug", next, user);
      slug = nextSlug;
    }
  }

  const themeId = parseThemeId(formData);

  try {
    await prisma.event.update({
      where: { id },
      data: {
        slug,
        title: String(formData.get("title") || event.title).trim(),
        summary: eventBlurb(description),
        description,
        venue: String(formData.get("venue") || event.venue).trim(),
        startsAt: new Date(String(formData.get("startsAt") || event.startsAt)),
        endsAt: new Date(String(formData.get("endsAt") || event.endsAt)),
        isNetworking: formData.get("isNetworking") === "on",
        isPaid,
        priceCents,
        currency: isPaid ? parseCurrencyFromForm(formData, event.currency) : event.currency,
        capacity: parseCapacityFromForm(formData),
        maxPerOrder: Math.max(1, Math.floor(Number(formData.get("maxPerOrder") || event.maxPerOrder))),
        allowOfflinePayment: isPaid,
        published: formData.get("published") === "on",
        ...(themeId !== undefined ? { themeId } : {}),
        contactDetails: formData.has("contactDetails")
          ? parseContactDetails(formData)
          : event.contactDetails,
        paymentInstructions: isPaid
          ? parsePaymentInstructions(formData, event.paymentInstructions ?? "")
          : event.paymentInstructions,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      failUpdate(id, "slug", next, user);
    }
    throw error;
  }

  if (next.startsWith("/admin") && isSuperadmin(user)) redirect(next);
  redirect(`/dashboard/events/${id}`);
}

export async function deleteEventAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isSuperadmin(user)) redirect("/admin");
  const id = String(formData.get("id") || "");
  await prisma.event.delete({ where: { id } });
  redirect("/admin");
}
