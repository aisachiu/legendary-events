"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperadmin } from "@/lib/roles";

const ROLES = new Set(["ATTENDEE", "ORGANIZER", "SUPERADMIN"]);
const REG_STATUSES = new Set(["PENDING_PAYMENT", "CONFIRMED", "CANCELLED"]);
const PAY_STATUSES = new Set(["UNPAID", "AWAITING_REVIEW", "PAID", "REJECTED"]);

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user || !isSuperadmin(user)) redirect("/login?next=/admin");
  return user;
}

export async function updateUserAdminAction(formData: FormData) {
  await requireSuperadmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "");
  const password = String(formData.get("password") || "");

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
      ...(password.length >= 8 ? { passwordHash: await hashPassword(password) } : {}),
    },
  });
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
      bioHeadline: String(formData.get("bioHeadline") || "").trim() || null,
      bioAbout: String(formData.get("bioAbout") || "").trim() || null,
      bioCompany: String(formData.get("bioCompany") || "").trim() || null,
      bioLinkedin: String(formData.get("bioLinkedin") || "").trim() || null,
    },
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
    data: { status, evidenceNote },
  });

  if (status === "PAID") {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (payment) {
      await prisma.registration.update({
        where: { id: payment.registrationId },
        data: { status: "CONFIRMED" },
      });
    }
  }
  redirect("/admin");
}
