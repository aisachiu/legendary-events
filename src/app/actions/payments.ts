"use server";

import path from "path";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getChannelBySlug } from "@/lib/channels";
import { prisma } from "@/lib/prisma";
import {
  bookingStatusFromSpots,
  isHeldStatus,
  occupyingSpotWhere,
  parseGuestNames,
  parseShowOnGoing,
  remainingSeats,
} from "@/lib/registrations";
import { canManageEvent, isSuperadmin } from "@/lib/roles";
import { storePrivateFile } from "@/lib/storage";

type Db = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type PaidChannel = { isPaid: boolean; priceCents: number; currency: string };

function profileFromForm(formData: FormData) {
  return {
    preferredName: String(formData.get("preferredName") || "").trim() || null,
    titlePosition: String(formData.get("titlePosition") || "").trim() || null,
    introBio: String(formData.get("introBio") || "").trim() || null,
    linkedinUrl: String(formData.get("linkedinUrl") || "").trim() || null,
  };
}

async function syncBookingStatus(tx: Db, registrationId: string) {
  const spots = await tx.spot.findMany({ where: { registrationId } });
  await tx.registration.update({
    where: { id: registrationId },
    data: { status: bookingStatusFromSpots(spots) },
  });
}

async function ensureSpotPayments(
  tx: Db,
  channel: PaidChannel,
  spots: { id: string; status: string }[],
) {
  if (!channel.isPaid) return;
  for (const spot of spots) {
    if (spot.status !== "PENDING_PAYMENT") continue;
    await tx.payment.upsert({
      where: { spotId: spot.id },
      update: {},
      create: {
        spotId: spot.id,
        method: "UNSET",
        status: "UNPAID",
        amountCents: channel.priceCents,
        currency: channel.currency,
      },
    });
  }
}

function partyStatus(opts: {
  isPaid: boolean;
  remaining: number;
  partySize: number;
  waitlistGroup: boolean;
  alreadyWaitlisted: boolean;
}) {
  const over = opts.partySize > opts.remaining;
  if (opts.alreadyWaitlisted) return "WAITLISTED";
  if (opts.waitlistGroup || over || opts.remaining === 0) return "WAITLISTED";
  return opts.isPaid ? "PENDING_PAYMENT" : "CONFIRMED";
}

const registrationChannelInclude = {
  channel: { include: { event: true } },
} as const;

export async function signupAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const channel = await getChannelBySlug(slug);
  if (!channel) redirect("/");

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/events/${slug}`);

  const profile = profileFromForm(formData);
  const { holder, extras } = parseGuestNames(formData, user.name);
  const names = [holder, ...extras];
  if (names.length < 1 || names.length > channel.maxPerOrder) {
    redirect(`/events/${slug}?error=party`);
  }
  const showOnGoing = channel.isNetworking
    ? parseShowOnGoing(formData, names.length)
    : names.map(() => true);

  const waitlistGroup = formData.get("waitlistGroup") === "on";

  const registration = await prisma.$transaction(async (tx) => {
    const existing = await tx.registration.findUnique({
      where: { channelId_userId: { channelId: channel.id, userId: user.id } },
    });

    if (existing && isHeldStatus(existing.status)) {
      return tx.registration.update({
        where: { id: existing.id },
        data: { ...profile, preferredName: holder },
      });
    }

    const occupyingOthers = await tx.spot.count({
      where: occupyingSpotWhere(channel.id, existing?.id),
    });
    const remaining = remainingSeats(channel.capacity, occupyingOthers);
    const over = names.length > remaining;
    if (over && remaining > 0 && !waitlistGroup) {
      redirect(
        `/events/${slug}?error=quota&remaining=${remaining}&wanted=${names.length}`,
      );
    }

    const status = partyStatus({
      isPaid: channel.isPaid,
      remaining,
      partySize: names.length,
      waitlistGroup,
      alreadyWaitlisted: false,
    });

    const row = await tx.registration.upsert({
      where: { channelId_userId: { channelId: channel.id, userId: user.id } },
      update: { ...profile, preferredName: holder, status },
      create: {
        channelId: channel.id,
        userId: user.id,
        status,
        ...profile,
        preferredName: holder,
      },
    });

    await tx.spot.deleteMany({ where: { registrationId: row.id } });
    await tx.spot.createMany({
      data: names.map((name, i) => ({
        registrationId: row.id,
        name,
        isHolder: i === 0,
        showOnGoing: showOnGoing[i],
        status,
      })),
    });
    const spots = await tx.spot.findMany({ where: { registrationId: row.id } });
    await ensureSpotPayments(tx, channel, spots);
    return tx.registration.findUniqueOrThrow({ where: { id: row.id } });
  });

  if (registration.status === "PENDING_PAYMENT") {
    redirect(`/events/${slug}/pay`);
  }
  redirect(`/events/${slug}/confirmation`);
}

export async function updatePartyAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const channel = await getChannelBySlug(slug);
  if (!channel) redirect("/");

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/events/${slug}/confirmation`);

  const { holder, extras } = parseGuestNames(formData, user.name);
  const names = [holder, ...extras];
  if (names.length < 1 || names.length > channel.maxPerOrder) {
    redirect(`/events/${slug}/confirmation?error=party`);
  }
  const showOnGoing = channel.isNetworking
    ? parseShowOnGoing(formData, names.length)
    : names.map(() => true);

  const waitlistGroup = formData.get("waitlistGroup") === "on";

  await prisma.$transaction(async (tx) => {
    const registration = await tx.registration.findUnique({
      where: { channelId_userId: { channelId: channel.id, userId: user.id } },
      include: { spots: { include: { payment: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!registration || registration.status === "CANCELLED") {
      redirect(`/events/${slug}`);
    }

    const occupyingOthers = await tx.spot.count({
      where: occupyingSpotWhere(channel.id, registration.id),
    });
    const remaining = remainingSeats(channel.capacity, occupyingOthers);
    const alreadyWaitlisted = registration.status === "WAITLISTED";
    const over = names.length > remaining && !alreadyWaitlisted;
    if (over && remaining > 0 && !waitlistGroup) {
      redirect(
        `/events/${slug}/confirmation?error=quota&remaining=${remaining}&wanted=${names.length}`,
      );
    }

    const status = partyStatus({
      isPaid: channel.isPaid,
      remaining,
      partySize: names.length,
      waitlistGroup,
      alreadyWaitlisted,
    });

    const existingSpots = registration.spots;
    for (let i = 0; i < names.length; i++) {
      const current = existingSpots[i];
      const spotStatus =
        status === "WAITLISTED"
          ? "WAITLISTED"
          : current?.payment?.status === "PAID"
            ? "CONFIRMED"
            : status;
      if (current) {
        await tx.spot.update({
          where: { id: current.id },
          data: {
            name: names[i],
            isHolder: i === 0,
            status: spotStatus,
            showOnGoing: showOnGoing[i],
          },
        });
      } else {
        const created = await tx.spot.create({
          data: {
            registrationId: registration.id,
            name: names[i],
            isHolder: i === 0,
            showOnGoing: showOnGoing[i],
            status: spotStatus,
          },
        });
        await ensureSpotPayments(tx, channel, [created]);
      }
    }
    if (existingSpots.length > names.length) {
      await tx.spot.deleteMany({
        where: {
          id: { in: existingSpots.slice(names.length).map((s) => s.id) },
        },
      });
    }
    const spots = await tx.spot.findMany({ where: { registrationId: registration.id } });
    await ensureSpotPayments(tx, channel, spots);
    await tx.registration.update({
      where: { id: registration.id },
      data: { preferredName: holder },
    });
    await syncBookingStatus(tx, registration.id);
  });

  redirect(`/events/${slug}/confirmation`);
}

export async function submitOfflinePaymentAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/events/${slug}/pay`);

  const channel = await getChannelBySlug(slug);
  if (!channel?.isPaid) redirect(`/events/${slug}/pay`);

  const registration = await prisma.registration.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId: user.id } },
    include: { spots: { include: { payment: true } } },
  });
  if (!registration) redirect(`/events/${slug}`);
  if (registration.status === "CONFIRMED") {
    redirect(`/events/${slug}/confirmation`);
  }
  if (registration.status === "WAITLISTED" || registration.status === "CANCELLED") {
    redirect(`/events/${slug}`);
  }

  const unpaid = registration.spots.filter(
    (s) => s.payment && s.payment.status !== "PAID" && s.payment.status !== "REFUNDED",
  );
  if (unpaid.length === 0) redirect(`/events/${slug}`);

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
      `evidence/${unpaid[0].payment!.id}/${Date.now()}${ext}`,
      Buffer.from(await file.arrayBuffer()),
      file.type || "application/octet-stream",
    );
  } catch {
    redirect(
      `/events/${slug}/pay?error=${encodeURIComponent("Could not store that file. Try again with a smaller PNG, JPG, or PDF.")}`,
    );
  }

  await prisma.payment.updateMany({
    where: { id: { in: unpaid.map((s) => s.payment!.id) } },
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

  const channel = await getChannelBySlug(slug);
  if (!channel) redirect("/");

  const registration = await prisma.registration.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId: user.id } },
    include: { spots: true },
  });
  const confirmed = registration?.spots.some((s) => s.status === "CONFIRMED");
  if (!registration || !confirmed) {
    redirect(`/events/${slug}`);
  }

  await prisma.registration.update({
    where: { id: registration.id },
    data: profileFromForm(formData),
  });
  const holderName = String(formData.get("preferredName") || "").trim();
  if (holderName) {
    await prisma.spot.updateMany({
      where: { registrationId: registration.id, isHolder: true },
      data: { name: holderName },
    });
  }

  redirect(`/events/${slug}/going`);
}

function redirectAfterHost(user: { role: string }, next: string, eventId: string) {
  if (next.startsWith("/admin") && isSuperadmin(user)) redirect(next);
  redirect(`/dashboard/events/${eventId}?mode=manage`);
}

export async function promoteFromWaitlistAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const registrationId = String(formData.get("registrationId") || "");
  const next = String(formData.get("next") || "");
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { ...registrationChannelInclude, spots: true },
  });
  if (!registration || !canManageEvent(user, registration.channel.event.organizerId)) {
    redirect("/dashboard");
  }
  if (registration.status !== "WAITLISTED") {
    redirectAfterHost(user, next, registration.channel.eventId);
  }

  const status = registration.channel.isPaid ? "PENDING_PAYMENT" : "CONFIRMED";
  await prisma.$transaction(async (tx) => {
    await tx.spot.updateMany({
      where: { registrationId: registration.id },
      data: { status },
    });
    const spots = await tx.spot.findMany({ where: { registrationId: registration.id } });
    await ensureSpotPayments(tx, registration.channel, spots);
    await tx.registration.update({
      where: { id: registration.id },
      data: { status },
    });
  });

  redirectAfterHost(user, next, registration.channel.eventId);
}

export async function markPaidAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const paymentId = String(formData.get("paymentId") || "");
  const decision = String(formData.get("decision") || "");
  const next = String(formData.get("next") || "");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      spot: {
        include: {
          registration: { include: registrationChannelInclude },
        },
      },
    },
  });
  if (!payment || !canManageEvent(user, payment.spot.registration.channel.event.organizerId)) {
    redirect("/dashboard");
  }

  if (decision === "paid") {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          markedPaidAt: new Date(),
          markedPaidById: user.id,
        },
      });
      if (payment.spot.status !== "CANCELLED") {
        await tx.spot.update({
          where: { id: payment.spotId },
          data: { status: "CONFIRMED" },
        });
        await syncBookingStatus(tx, payment.spot.registrationId);
      }
    });
  } else if (decision === "reject") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "REJECTED" },
    });
  }

  redirectAfterHost(user, next, payment.spot.registration.channel.eventId);
}

export async function markGroupPaidAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const registrationId = String(formData.get("registrationId") || "");
  const next = String(formData.get("next") || "");
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { ...registrationChannelInclude, spots: { include: { payment: true } } },
  });
  if (!registration || !canManageEvent(user, registration.channel.event.organizerId)) {
    redirect("/dashboard");
  }

  await prisma.$transaction(async (tx) => {
    for (const spot of registration.spots) {
      if (spot.status === "CANCELLED" && registration.status !== "CANCELLED") continue;
      if (spot.payment && spot.payment.status !== "PAID" && spot.payment.status !== "REFUNDED") {
        await tx.payment.update({
          where: { id: spot.payment.id },
          data: {
            status: "PAID",
            markedPaidAt: new Date(),
            markedPaidById: user.id,
          },
        });
      }
      if (spot.status !== "CANCELLED") {
        await tx.spot.update({
          where: { id: spot.id },
          data: { status: "CONFIRMED" },
        });
      }
    }
    if (registration.status !== "CANCELLED") {
      await syncBookingStatus(tx, registration.id);
    }
  });

  redirectAfterHost(user, next, registration.channel.eventId);
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
    include: {
      spot: {
        include: {
          registration: { include: registrationChannelInclude },
        },
      },
    },
  });
  if (!payment || !canManageEvent(user, payment.spot.registration.channel.event.organizerId)) {
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

  redirectAfterHost(user, next, payment.spot.registration.channel.eventId);
}

export async function addSpotHostAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const registrationId = String(formData.get("registrationId") || "");
  const name = String(formData.get("name") || "").trim();
  const next = String(formData.get("next") || "");
  if (!name) redirect("/dashboard");

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { ...registrationChannelInclude, spots: { include: { payment: true } } },
  });
  if (!registration || !canManageEvent(user, registration.channel.event.organizerId)) {
    redirect("/dashboard");
  }
  if (registration.status === "CANCELLED") {
    redirectAfterHost(user, next, registration.channel.eventId);
  }

  const active = registration.spots.filter((s) => s.status !== "CANCELLED");
  if (active.length >= registration.channel.maxPerOrder) {
    redirectAfterHost(user, next, registration.channel.eventId);
  }

  const status =
    registration.status === "WAITLISTED"
      ? "WAITLISTED"
      : registration.channel.isPaid
        ? "PENDING_PAYMENT"
        : "CONFIRMED";

  await prisma.$transaction(async (tx) => {
    const created = await tx.spot.create({
      data: {
        registrationId: registration.id,
        name,
        isHolder: false,
        status,
      },
    });
    await ensureSpotPayments(tx, registration.channel, [created]);
    await syncBookingStatus(tx, registration.id);
  });

  redirectAfterHost(user, next, registration.channel.eventId);
}

export async function removeSpotHostAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const spotId = String(formData.get("spotId") || "");
  const next = String(formData.get("next") || "");
  const spot = await prisma.spot.findUnique({
    where: { id: spotId },
    include: {
      payment: true,
      registration: { include: { ...registrationChannelInclude, spots: true } },
    },
  });
  if (!spot || !canManageEvent(user, spot.registration.channel.event.organizerId)) {
    redirect("/dashboard");
  }

  const active = spot.registration.spots.filter((s) => s.status !== "CANCELLED");
  if (active.length <= 1) {
    redirectAfterHost(user, next, spot.registration.channel.eventId);
  }
  if (spot.payment?.status === "PAID") {
    redirectAfterHost(user, next, spot.registration.channel.eventId);
  }

  await prisma.$transaction(async (tx) => {
    if (spot.payment) {
      await tx.payment.delete({ where: { id: spot.payment.id } });
    }
    await tx.spot.delete({ where: { id: spot.id } });
    await syncBookingStatus(tx, spot.registrationId);
  });

  redirectAfterHost(user, next, spot.registration.channel.eventId);
}

export async function updateSpotAmountAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const paymentId = String(formData.get("paymentId") || "");
  const amount = Number(formData.get("amount") || 0);
  const next = String(formData.get("next") || "");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      spot: {
        include: {
          registration: { include: registrationChannelInclude },
        },
      },
    },
  });
  if (!payment || !canManageEvent(user, payment.spot.registration.channel.event.organizerId)) {
    redirect("/dashboard");
  }
  if (payment.status === "PAID" || payment.status === "REFUNDED") {
    redirectAfterHost(user, next, payment.spot.registration.channel.eventId);
  }

  const amountCents = Math.max(0, Math.round(amount * 100));
  await prisma.payment.update({
    where: { id: payment.id },
    data: { amountCents },
  });

  redirectAfterHost(user, next, payment.spot.registration.channel.eventId);
}

export async function setGroupTotalAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const registrationId = String(formData.get("registrationId") || "");
  const total = Number(formData.get("groupTotal") || 0);
  const next = String(formData.get("next") || "");
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { ...registrationChannelInclude, spots: { include: { payment: true } } },
  });
  if (!registration || !canManageEvent(user, registration.channel.event.organizerId)) {
    redirect("/dashboard");
  }

  const unpaid = registration.spots.filter(
    (s) =>
      (registration.status === "CANCELLED" || s.status !== "CANCELLED") &&
      s.payment &&
      s.payment.status !== "PAID" &&
      s.payment.status !== "REFUNDED",
  );
  if (unpaid.length === 0) {
    redirectAfterHost(user, next, registration.channel.eventId);
  }

  const totalCents = Math.max(0, Math.round(total * 100));
  const base = Math.floor(totalCents / unpaid.length);
  let remainder = totalCents - base * unpaid.length;

  await prisma.$transaction(async (tx) => {
    for (const spot of unpaid) {
      const cents = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      await tx.payment.update({
        where: { id: spot.payment!.id },
        data: { amountCents: cents },
      });
    }
  });

  redirectAfterHost(user, next, registration.channel.eventId);
}

export async function cancelAttendanceAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const registrationId = String(formData.get("registrationId") || "");
  const next = String(formData.get("next") || "");
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: registrationChannelInclude,
  });
  if (!registration) redirect("/dashboard");

  const allowed =
    registration.userId === user.id ||
    canManageEvent(user, registration.channel.event.organizerId);
  if (!allowed) redirect("/dashboard");

  await prisma.$transaction([
    prisma.spot.updateMany({
      where: { registrationId: registration.id },
      data: { status: "CANCELLED" },
    }),
    prisma.registration.update({
      where: { id: registration.id },
      data: { status: "CANCELLED" },
    }),
  ]);

  if (
    registration.userId === user.id &&
    !canManageEvent(user, registration.channel.event.organizerId)
  ) {
    redirect(`/events/${registration.channel.slug}`);
  }
  redirectAfterHost(user, next, registration.channel.eventId);
}
