"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookingStatusFromSpots } from "@/lib/registrations";
import { isSuperadmin } from "@/lib/roles";
import { DEFAULT_SITE_THEME, isThemeId } from "@/lib/themes";

const ROLES = new Set(["ATTENDEE", "ORGANIZER", "SUPERADMIN"]);
const REG_STATUSES = new Set(["PENDING_PAYMENT", "CONFIRMED", "WAITLISTED", "CANCELLED"]);
const PAY_STATUSES = new Set([
  "UNPAID",
  "AWAITING_REVIEW",
  "PAID",
  "REJECTED",
  "REFUNDED",
]);

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user || !isSuperadmin(user)) redirect("/login?next=/admin");
  return user;
}

export async function createUserAdminAction(formData: FormData) {
  await requireSuperadmin();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "ATTENDEE");
  if (!name || !email || !ROLES.has(role)) {
    redirect("/admin?error=user-create");
  }
  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) redirect("/admin?error=user-exists");
  await prisma.user.create({
    data: {
      name,
      email,
      role,
    },
  });
  redirect("/admin");
}

export async function updateUserAdminAction(formData: FormData) {
  await requireSuperadmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "");

  if (!id || !name || !email || !ROLES.has(role)) redirect("/admin");

  if (role !== "SUPERADMIN") {
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.role === "SUPERADMIN") {
      const remaining = await prisma.user.count({
        where: { role: "SUPERADMIN", id: { not: id } },
      });
      if (remaining === 0) redirect("/admin?error=last-admin");
    }
  }

  await prisma.user.update({
    where: { id },
    data: {
      name,
      email,
      role,
    },
  });
  redirect("/admin");
}

export async function deleteUserAdminAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const id = String(formData.get("id") || "");
  if (!id || id === actor.id) redirect("/admin?error=user-delete");

  const target = await prisma.user.findUnique({
    where: { id },
    include: { _count: { select: { events: true } } },
  });
  if (!target) redirect("/admin");
  if (target.role === "SUPERADMIN") {
    const remaining = await prisma.user.count({
      where: { role: "SUPERADMIN", id: { not: id } },
    });
    if (remaining === 0) redirect("/admin?error=last-admin");
  }
  if (target._count.events > 0) {
    redirect("/admin?error=user-hosts");
  }

  await prisma.user.delete({ where: { id } });
  redirect("/admin");
}

export async function updateRegistrationAdminAction(formData: FormData) {
  await requireSuperadmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !REG_STATUSES.has(status)) redirect("/admin");

  await prisma.registration.update({
    where: { id },
    data: {
      status,
      preferredName: String(formData.get("preferredName") || "").trim() || null,
      titlePosition: String(formData.get("titlePosition") || "").trim() || null,
      introBio: String(formData.get("introBio") || "").trim() || null,
      linkedinUrl: String(formData.get("linkedinUrl") || "").trim() || null,
    },
  });
  await prisma.spot.updateMany({
    where: { registrationId: id },
    data: { status },
  });
  redirect("/admin");
}

export async function updatePaymentAdminAction(formData: FormData) {
  await requireSuperadmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  const evidenceNote = String(formData.get("evidenceNote") || "").trim() || null;
  if (!id || !PAY_STATUSES.has(status)) redirect("/admin");

  await prisma.payment.update({
    where: { id },
    data: {
      status,
      evidenceNote,
      ...(status === "REFUNDED"
        ? { refundedAt: new Date(), refundAmountCents: undefined }
        : {}),
    },
  });

  if (status === "PAID") {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { spot: true },
    });
    if (payment) {
      await prisma.spot.update({
        where: { id: payment.spotId },
        data: { status: "CONFIRMED" },
      });
      const spots = await prisma.spot.findMany({
        where: { registrationId: payment.spot.registrationId },
      });
      await prisma.registration.update({
        where: { id: payment.spot.registrationId },
        data: { status: bookingStatusFromSpots(spots) },
      });
    }
  }
  redirect("/admin");
}

export async function updateSiteSettingsAction(formData: FormData) {
  await requireSuperadmin();
  const raw = String(formData.get("siteThemeId") || "");
  const siteThemeId = isThemeId(raw) ? raw : DEFAULT_SITE_THEME;
  await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: { siteThemeId },
    create: { id: "default", siteThemeId },
  });
  redirect("/admin");
}
