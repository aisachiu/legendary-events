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

function parseVisibility(formData: FormData, fallback = "PUBLIC") {
  const raw = String(formData.get("visibility") || fallback).trim().toUpperCase();
  return raw === "UNLISTED" ? "UNLISTED" : "PUBLIC";
}

function parseGoingVisibility(formData: FormData, fallback = "CHANNEL") {
  const raw = String(formData.get("goingVisibility") || fallback).trim().toUpperCase();
  return raw === "EVENT" ? "EVENT" : "CHANNEL";
}

function failCreate(error: string): never {
  redirect(`/dashboard/events/new?error=${error}`);
}

function failUpdate(id: string, error: string, next: string, user: { role: string }): never {
  if (next.startsWith("/admin") && isSuperadmin(user)) {
    redirect(`${next}${next.includes("?") ? "&" : "?"}error=${error}`);
  }
  redirect(`/dashboard/events/${id}?tab=details&error=${error}`);
}

async function resolveCustomSlug(raw: string, excludeChannelId?: string) {
  const slug = parseEventSlug(raw);
  if (!slug) return null;
  if (await eventSlugTaken(slug, excludeChannelId)) return null;
  return slug;
}

function channelFieldsFromForm(
  formData: FormData,
  opts: {
    descriptionFallback?: string;
    paymentInstructionsFallback?: string;
    currencyFallback?: string;
    maxPerOrderFallback?: number;
    goingVisibilityFallback?: string;
  } = {},
) {
  const channelName = String(formData.get("channelName") || "").trim();
  const description = parseDescription(formData, opts.descriptionFallback ?? "");
  const venue = String(formData.get("venue") || "").trim();
  const startsAt = String(formData.get("startsAt") || "");
  const endsAt = String(formData.get("endsAt") || "");
  const isNetworking = formData.get("isNetworking") === "on";
  const isPaid = formData.get("isPaid") === "on";
  const price = Number(formData.get("price") || 0);
  const paymentInstructions = parsePaymentInstructions(
    formData,
    opts.paymentInstructionsFallback ?? "",
  );
  const currency = isPaid
    ? parseCurrencyFromForm(formData, opts.currencyFallback)
    : (opts.currencyFallback ?? "hkd");
  const capacity = parseCapacityFromForm(formData);
  const maxPerOrder = Math.max(
    1,
    Math.floor(Number(formData.get("maxPerOrder") || opts.maxPerOrderFallback || 1)),
  );
  const goingVisibility = parseGoingVisibility(formData, opts.goingVisibilityFallback);
  const priceCents = isPaid ? Math.round(price * 100) : 0;

  return {
    channelName,
    description,
    venue,
    startsAt,
    endsAt,
    isNetworking,
    isPaid,
    priceCents,
    currency,
    capacity,
    maxPerOrder,
    goingVisibility,
    paymentInstructions,
  };
}

export async function createEventAction(formData: FormData) {
  const user = await requireHost();
  const title = String(formData.get("title") || "").trim();
  const visibility = parseVisibility(formData);
  const fields = channelFieldsFromForm(formData);

  if (
    !title ||
    !fields.channelName ||
    !stripHtml(fields.description) ||
    !fields.venue ||
    !fields.startsAt
  ) {
    failCreate("missing");
  }

  const start = new Date(fields.startsAt);
  const end = fields.endsAt
    ? new Date(fields.endsAt)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  if (fields.isPaid && fields.priceCents < 100) {
    failCreate("price");
  }

  const slugRaw = String(formData.get("slug") || "").trim();
  const slugDesired = slugRaw || fields.channelName || title;
  const slug = slugRaw
    ? await resolveCustomSlug(slugRaw)
    : await allocateEventSlug(slugDesired);
  if (!slug) failCreate("slug");

  let event;
  try {
    event = await prisma.event.create({
      data: {
        title,
        visibility,
        organizerId: user.id,
        channels: {
          create: {
            name: fields.channelName,
            slug,
            summary: eventBlurb(fields.description),
            description: fields.description,
            venue: fields.venue,
            startsAt: start,
            endsAt: end,
            isNetworking: fields.isNetworking,
            isPaid: fields.isPaid,
            priceCents: fields.priceCents,
            currency: fields.currency,
            capacity: fields.capacity,
            maxPerOrder: fields.maxPerOrder,
            allowOfflinePayment: fields.isPaid,
            paymentInstructions: fields.isPaid ? fields.paymentInstructions : null,
            themeId: parseThemeId(formData) ?? null,
            contactDetails: parseContactDetails(formData),
            goingVisibility: fields.goingVisibility,
          },
        },
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
  const event = await prisma.event.findUnique({
    where: { id },
    include: { channels: { orderBy: { createdAt: "asc" } } },
  });
  if (!event || !canManageEvent(user, event.organizerId)) redirect("/dashboard");

  const title = String(formData.get("title") || event.title).trim();
  const visibility = parseVisibility(formData, event.visibility);

  const channelIdRaw = String(formData.get("channelId") || "").trim();
  const creatingNew = !channelIdRaw || channelIdRaw === "new";
  const existingChannel = creatingNew
    ? null
    : event.channels.find((c) => c.id === channelIdRaw) ?? null;

  if (!creatingNew && !existingChannel) {
    failUpdate(id, "missing", next, user);
  }

  const fields = channelFieldsFromForm(formData, {
    descriptionFallback: existingChannel?.description,
    paymentInstructionsFallback: existingChannel?.paymentInstructions ?? "",
    currencyFallback: existingChannel?.currency,
    maxPerOrderFallback: existingChannel?.maxPerOrder,
    goingVisibilityFallback: existingChannel?.goingVisibility,
  });

  if (
    !title ||
    !fields.channelName ||
    !stripHtml(fields.description) ||
    !fields.venue ||
    !fields.startsAt
  ) {
    failUpdate(id, "missing", next, user);
  }

  if (fields.isPaid && fields.priceCents < 100) {
    failUpdate(id, "price", next, user);
  }

  const start = new Date(fields.startsAt);
  const end = fields.endsAt
    ? new Date(fields.endsAt)
    : existingChannel
      ? existingChannel.endsAt
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const slugRaw = String(formData.get("slug") || "").trim();
  let slug = existingChannel?.slug ?? "";
  if (formData.has("slug")) {
    if (slugRaw) {
      const nextSlug = await resolveCustomSlug(slugRaw, existingChannel?.id);
      if (!nextSlug) failUpdate(id, "slug", next, user);
      slug = nextSlug;
    } else if (!existingChannel) {
      slug = await allocateEventSlug(fields.channelName || title);
    }
  } else if (!existingChannel) {
    slug = await allocateEventSlug(fields.channelName || title);
  }

  const themeId = parseThemeId(formData);
  const channelData = {
    name: fields.channelName,
    slug,
    summary: eventBlurb(fields.description),
    description: fields.description,
    venue: fields.venue,
    startsAt: start,
    endsAt: end,
    isNetworking: fields.isNetworking,
    isPaid: fields.isPaid,
    priceCents: fields.priceCents,
    currency: fields.currency,
    capacity: fields.capacity,
    maxPerOrder: fields.maxPerOrder,
    allowOfflinePayment: fields.isPaid,
    goingVisibility: fields.goingVisibility,
    ...(themeId !== undefined ? { themeId } : {}),
    contactDetails: formData.has("contactDetails")
      ? parseContactDetails(formData)
      : (existingChannel?.contactDetails ?? null),
    paymentInstructions: fields.isPaid
      ? fields.paymentInstructions
      : (existingChannel?.paymentInstructions ?? null),
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id },
        data: { title, visibility },
      });

      if (existingChannel) {
        await tx.channel.update({
          where: { id: existingChannel.id },
          data: channelData,
        });
      } else {
        await tx.channel.create({
          data: {
            eventId: id,
            ...channelData,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      failUpdate(id, "slug", next, user);
    }
    throw error;
  }

  if (next.startsWith("/admin") && isSuperadmin(user)) redirect(next);
  if (existingChannel) {
    redirect(`/dashboard/events/${id}?tab=details&channel=${existingChannel.id}`);
  }
  const created = await prisma.channel.findFirst({
    where: { eventId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (created) {
    redirect(`/dashboard/events/${id}?tab=details&channel=${created.id}`);
  }
  redirect(`/dashboard/events/${id}?tab=details`);
}

export async function deleteEventAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isSuperadmin(user)) redirect("/admin");
  const id = String(formData.get("id") || "");
  await prisma.event.delete({ where: { id } });
  redirect("/admin");
}
