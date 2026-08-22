"use server";

import path from "path";
import { redirect } from "next/navigation";
import { getCurrentUser, hashPassword, setSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageEvent, isSuperadmin } from "@/lib/roles";
import { storeEvidence } from "@/lib/storage";

async function ensureUser(formData: FormData) {
  const existing = await getCurrentUser();
  if (existing) return existing;

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!name || !email || password.length < 8) {
    return null;
  }

  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) return null;

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "ATTENDEE",
    },
  });
  await setSession(user.id);
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function signupAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event || !event.published) {
    redirect("/");
  }

  const user = await ensureUser(formData);
  if (!user) {
    redirect(
      `/events/${slug}?error=${encodeURIComponent("Create an account (or sign in) with name, email, and an 8+ character password.")}`,
    );
  }

  const bioHeadline = String(formData.get("bioHeadline") || "").trim() || null;
  const bioAbout = String(formData.get("bioAbout") || "").trim() || null;
  const bioCompany = String(formData.get("bioCompany") || "").trim() || null;
  const bioLinkedin = String(formData.get("bioLinkedin") || "").trim() || null;

  const status = event.isPaid ? "PENDING_PAYMENT" : "CONFIRMED";

  const registration = await prisma.registration.upsert({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
    update: { bioHeadline, bioAbout, bioCompany, bioLinkedin },
    create: {
      eventId: event.id,
      userId: user.id,
      status,
      bioHeadline,
      bioAbout,
      bioCompany,
      bioLinkedin,
    },
  });

  if (event.isPaid) {
    await prisma.payment.upsert({
      where: { registrationId: registration.id },
      update: {},
      create: {
        registrationId: registration.id,
        method: "UNSET",
        status: "UNPAID",
        amountCents: event.priceCents,
        currency: event.currency,
      },
    });
  }

  if (!event.isPaid || registration.status === "CONFIRMED") {
    redirect(`/events/${slug}/confirmation`);
  }

  redirect(`/events/${slug}/pay`);
}

export async function submitOfflinePaymentAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/events/${slug}/pay`);

  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event?.isPaid) {
    redirect(`/events/${slug}/pay`);
  }

  const registration = await prisma.registration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
    include: { payment: true },
  });
  if (!registration?.payment) redirect(`/events/${slug}`);
  if (registration.status === "CONFIRMED") {
    redirect(`/events/${slug}/confirmation`);
  }

  const note = String(formData.get("evidenceNote") || "").trim();
  const file = formData.get("evidence") as File | null;
  if (!file || file.size === 0) {
    redirect(
      `/events/${slug}/pay?error=${encodeURIComponent("Upload a receipt, screenshot, or transfer confirmation.")}`,
    );
  }
  if (file.size > 8 * 1024 * 1024) {
    redirect(`/events/${slug}/pay?error=${encodeURIComponent("File must be under 8MB.")}`);
  }

  const ext = path.extname(file.name || "").toLowerCase() || ".bin";
  const allowed = [".png", ".jpg", ".jpeg", ".webp", ".pdf", ".gif"];
  if (!allowed.includes(ext)) {
    redirect(
      `/events/${slug}/pay?error=${encodeURIComponent("Use a PNG, JPG, WEBP, GIF, or PDF.")}`,
    );
  }

  const filename = `${registration.payment.id}${ext}`;
  const evidencePath = await storeEvidence(
    filename,
    Buffer.from(await file.arrayBuffer()),
    file.type || "application/octet-stream",
  );

  await prisma.payment.update({
    where: { id: registration.payment.id },
    data: {
      method: "OFFLINE",
      status: "AWAITING_REVIEW",
      evidencePath,
      evidenceNote: note || null,
    },
  });

  redirect(`/events/${slug}/confirmation`);
}

export async function saveBioAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/events/${slug}/room`);

  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) redirect("/");

  const registration = await prisma.registration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
  });
  if (!registration || registration.status !== "CONFIRMED") {
    redirect(`/events/${slug}`);
  }

  await prisma.registration.update({
    where: { id: registration.id },
    data: {
      bioHeadline: String(formData.get("bioHeadline") || "").trim() || null,
      bioAbout: String(formData.get("bioAbout") || "").trim() || null,
      bioCompany: String(formData.get("bioCompany") || "").trim() || null,
      bioLinkedin: String(formData.get("bioLinkedin") || "").trim() || null,
    },
  });

  redirect(`/events/${slug}/room`);
}

export async function markPaidAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const paymentId = String(formData.get("paymentId") || "");
  const decision = String(formData.get("decision") || "");
  const next = String(formData.get("next") || "");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { registration: { include: { event: true } } },
  });
  if (!payment || !canManageEvent(user, payment.registration.event.organizerId)) {
    redirect("/dashboard");
  }

  if (decision === "paid") {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          markedPaidAt: new Date(),
          markedPaidById: user.id,
        },
      }),
      prisma.registration.update({
        where: { id: payment.registrationId },
        data: { status: "CONFIRMED" },
      }),
    ]);
  } else if (decision === "reject") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "REJECTED" },
    });
  }

  if (next.startsWith("/admin") && isSuperadmin(user)) {
    redirect(next);
  }
  redirect(`/dashboard/events/${payment.registration.eventId}`);
}
