"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { parseCapacityFromForm, parseCurrencyFromForm } from "@/lib/currency";
import { sanitizeEventHtml, stripHtml } from "@/lib/event-html";
import { slugify } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canHost, canManageEvent, isSuperadmin } from "@/lib/roles";
import { eventBlurb, storeImageFromForm } from "@/lib/storage";

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
  const paymentInstructions =
    String(formData.get("paymentInstructions") || "").trim() || null;
  const currency = isPaid ? parseCurrencyFromForm(formData) : "hkd";
  const capacity = parseCapacityFromForm(formData);

  if (!title || !stripHtml(description) || !venue || !startsAt) {
    redirect("/dashboard/events/new?error=missing");
  }

  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const priceCents = isPaid ? Math.round(price * 100) : 0;
  if (isPaid && priceCents < 100) {
    redirect("/dashboard/events/new?error=price");
  }

  const paymentImage = formData.get("paymentImage") as File | null;
  const paymentImagePath = isPaid
    ? await storeImageFromForm(paymentImage, "pay-images")
    : null;

  const event = await prisma.event.create({
    data: {
      slug: slugify(title),
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
      allowOfflinePayment: isPaid,
      paymentInstructions: isPaid ? paymentInstructions : null,
      paymentImagePath,
      organizerId: user.id,
    },
  });

  redirect(`/dashboard/events/${event.id}`);
}

export async function updateEventAction(formData: FormData) {
  const user = await requireHost();
  const id = String(formData.get("id") || "");
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || !canManageEvent(user, event.organizerId)) redirect("/dashboard");

  const isPaid = formData.get("isPaid") === "on";
  const description = parseDescription(formData, event.description);
  const paymentImage = formData.get("paymentImage") as File | null;
  const uploaded = isPaid ? await storeImageFromForm(paymentImage, "pay-images") : null;
  const priceCents = isPaid ? Math.round(Number(formData.get("price") || 0) * 100) : 0;

  await prisma.event.update({
    where: { id },
    data: {
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
      allowOfflinePayment: isPaid,
      published: formData.get("published") === "on",
      paymentInstructions: isPaid
        ? String(formData.get("paymentInstructions") || "").trim() || null
        : event.paymentInstructions,
      ...(uploaded ? { paymentImagePath: uploaded } : {}),
    },
  });

  const next = String(formData.get("next") || "");
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
