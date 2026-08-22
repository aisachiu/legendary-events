"use server";

import path from "path";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isHeldStatus, occupyingWhere } from "@/lib/registrations";
import { canManageEvent, isSuperadmin } from "@/lib/roles";
import { storePrivateFile } from "@/lib/storage";

async function ensureUser() {
  return getCurrentUser();
}

function profileFromForm(formData: FormData) {
  return {
    preferredName: String(formData.get("preferredName") || "").trim() || null,
    titlePosition: String(formData.get("titlePosition") || "").trim() || null,
    introBio: String(formData.get("introBio") || "").trim() || null,
    linkedinUrl: String(formData.get("linkedinUrl") || "").trim() || null,
  };
}

export async function signupAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event || !event.published) {
    redirect("/");
  }

  const user = await ensureUser();
  if (!user) {
    redirect(`/login?next=/events/${slug}`);
  }

  const profile = profileFromForm(formData);

  const registration = await prisma.$transaction(async (tx) => {
    const existing = await tx.registration.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
    });
    const occupying = await tx.registration.count({
      where: occupyingWhere(event.id, user.id),
    });
    const full = event.capacity != null && occupying >= event.capacity;

    let status: string;
    if (existing && isHeldStatus(existing.status)) {
      status = existing.status;
    } else if (full) {
      status = "WAITLISTED";
    } else {
      status = event.isPaid ? "PENDING_PAYMENT" : "CONFIRMED";
    }

    const row = await tx.registration.upsert({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
      update: { ...profile, status },
      create: {
        eventId: event.id,
        userId: user.id,
        status,
        ...profile,
      },
    });

    if (status === "PENDING_PAYMENT" && event.isPaid) {
      await tx.payment.upsert({
        where: { registrationId: row.id },
        update: {},
        create: {
          registrationId: row.id,
          method: "UNSET",
          status: "UNPAID",
          amountCents: event.priceCents,
          currency: event.currency,
        },
      });
    }

    return row;
  });

  if (registration.status === "PENDING_PAYMENT") {
    redirect(`/events/${slug}/pay`);
  }

  redirect(`/events/${slug}/confirmation`);
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
  if (registration.status === "WAITLISTED" || registration.status === "CANCELLED") {
    redirect(`/events/${slug}`);
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

  let evidencePath: string;
  try {
    evidencePath = await storePrivateFile(
      `evidence/${registration.payment.id}/${Date.now()}${ext}`,
      Buffer.from(await file.arrayBuffer()),
      file.type || "application/octet-stream",
    );
  } catch {
    redirect(
      `/events/${slug}/pay?error=${encodeURIComponent("Could not store that file. Try again with a smaller PNG, JPG, or PDF.")}`,
    );
  }

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
  if (!user) redirect(`/login?next=/events/${slug}/going`);

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
    data: profileFromForm(formData),
  });

  redirect(`/events/${slug}/going`);
}

function redirectAfterHost(user: { role: string }, next: string, eventId: string) {
  if (next.startsWith("/admin") && isSuperadmin(user)) redirect(next);
  redirect(`/dashboard/events/${eventId}`);
}

export async function promoteFromWaitlistAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const registrationId = String(formData.get("registrationId") || "");
  const next = String(formData.get("next") || "");
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true, payment: true },
  });
  if (!registration || !canManageEvent(user, registration.event.organizerId)) {
    redirect("/dashboard");
  }
  if (registration.status !== "WAITLISTED") {
    redirectAfterHost(user, next, registration.eventId);
  }

  const status = registration.event.isPaid ? "PENDING_PAYMENT" : "CONFIRMED";
  await prisma.registration.update({
    where: { id: registration.id },
    data: { status },
  });

  if (registration.event.isPaid && !registration.payment) {
    await prisma.payment.create({
      data: {
        registrationId: registration.id,
        method: "UNSET",
        status: "UNPAID",
        amountCents: registration.event.priceCents,
        currency: registration.event.currency,
      },
    });
  }

  redirectAfterHost(user, next, registration.eventId);
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

  redirectAfterHost(user, next, payment.registration.eventId);
}

export async function markRefundedAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const paymentId = String(formData.get("paymentId") || "");
  const refundNote = String(formData.get("refundNote") || "").trim() || null;
  const refundAmount = Number(formData.get("refundAmount") || 0);
  const next = String(formData.get("next") || "");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { registration: { include: { event: true } } },
  });
  if (!payment || !canManageEvent(user, payment.registration.event.organizerId)) {
    redirect("/dashboard");
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "REFUNDED",
      refundedAt: new Date(),
      refundNote,
      refundAmountCents:
        refundAmount > 0 ? Math.round(refundAmount * 100) : payment.amountCents,
    },
  });

  redirectAfterHost(user, next, payment.registration.eventId);
}

export async function cancelAttendanceAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const registrationId = String(formData.get("registrationId") || "");
  const next = String(formData.get("next") || "");
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  });
  if (!registration) redirect("/dashboard");

  const allowed =
    registration.userId === user.id || canManageEvent(user, registration.event.organizerId);
  if (!allowed) redirect("/dashboard");

  await prisma.registration.update({
    where: { id: registration.id },
    data: { status: "CANCELLED" },
  });

  if (registration.userId === user.id && !canManageEvent(user, registration.event.organizerId)) {
    redirect(`/events/${registration.event.slug}`);
  }
  redirectAfterHost(user, next, registration.eventId);
}
