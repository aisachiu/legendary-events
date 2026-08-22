"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canHost, canManageEvent, isSuperadmin } from "@/lib/roles";

async function requireHost() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  if (!canHost(user)) {
    redirect("/dashboard?error=host");
  }
  return user;
}

export async function createEventAction(formData: FormData) {
  const user = await requireHost();
  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const venue = String(formData.get("venue") || "").trim();
  const startsAt = String(formData.get("startsAt") || "");
  const endsAt = String(formData.get("endsAt") || "");
  const isNetworking = formData.get("isNetworking") === "on";
  const isPaid = formData.get("isPaid") === "on";
  const price = Number(formData.get("price") || 0);

  if (!title || !summary || !description || !venue || !startsAt || !endsAt) {
    redirect("/dashboard/events/new?error=missing");
  }

  const priceCents = isPaid ? Math.round(price * 100) : 0;
  if (isPaid && priceCents < 100) {
    redirect("/dashboard/events/new?error=price");
  }

  const event = await prisma.event.create({
    data: {
      slug: slugify(title),
      title,
      summary,
      description,
      venue,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      isNetworking,
      isPaid,
      priceCents,
      allowOfflinePayment: isPaid,
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
  await prisma.event.update({
    where: { id },
    data: {
      title: String(formData.get("title") || event.title).trim(),
      summary: String(formData.get("summary") || event.summary).trim(),
      description: String(formData.get("description") || event.description).trim(),
      venue: String(formData.get("venue") || event.venue).trim(),
      startsAt: new Date(String(formData.get("startsAt") || event.startsAt)),
      endsAt: new Date(String(formData.get("endsAt") || event.endsAt)),
      isNetworking: formData.get("isNetworking") === "on",
      isPaid,
      priceCents: isPaid ? Math.round(Number(formData.get("price") || 0) * 100) : 0,
      allowOfflinePayment: isPaid,
      published: formData.get("published") === "on",
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
