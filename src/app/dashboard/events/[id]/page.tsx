import Link from "next/link";
import { redirect } from "next/navigation";
import { updateEventAction } from "@/app/actions/events";
import {
  addSpotHostAction,
  cancelAttendanceAction,
  markGroupPaidAction,
  markPaidAction,
  markRefundedAction,
  promoteFromWaitlistAction,
  removeSpotHostAction,
  setGroupTotalAction,
  updateSpotAmountAction,
} from "@/app/actions/payments";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { EventForm } from "@/components/EventForm";
import { StatusPills } from "@/components/Pills";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney, formatWhen, toDatetimeLocal } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { OCCUPYING_STATUSES } from "@/lib/registrations";
import { canManageEvent } from "@/lib/roles";
import { publicEventUrl } from "@/lib/slugs";

export default async function EventDeskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      registrations: {
        include: {
          user: true,
          spots: { include: { payment: true }, orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!event || !canManageEvent(user, event.organizerId)) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>You do not host this event.</p>
      </div>
    );
  }

  const occupyingSpots = event.registrations.flatMap((r) =>
    r.spots.filter((s) => (OCCUPYING_STATUSES as readonly string[]).includes(s.status)),
  );
  const occupying = event.registrations.filter((r) =>
    r.spots.some((s) => (OCCUPYING_STATUSES as readonly string[]).includes(s.status)),
  );
  const waitlist = event.registrations.filter((r) => r.status === "WAITLISTED");
  const cancelled = event.registrations.filter((r) => r.status === "CANCELLED");
  const waitlistSpots = waitlist.reduce((n, r) => n + r.spots.filter((s) => s.status === "WAITLISTED").length, 0);
  const cancelledSpots = cancelled.reduce((n, r) => n + r.spots.length, 0);
  const occupancyLabel =
    event.capacity != null
      ? `${occupyingSpots.length} / ${event.capacity} participants (you can exceed quota)`
      : `${occupyingSpots.length} participants`;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link href="/dashboard" className="text-sm text-[var(--mute)]">
        ← Host desk
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-4xl">{event.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/events/${event.id}/guest-list`} className="btn-line">
            Guest list
          </Link>
          <Link href={`/events/${event.slug}`} className="btn-line">
            Public page
          </Link>
          <CopyLinkButton url={publicEventUrl(event.slug)} label="Copy public link" />
        </div>
      </div>
      <p className="mt-2 text-sm text-[var(--mute)]">
        {formatWhen(event.startsAt)} · {occupancyLabel}
        {waitlistSpots ? ` · ${waitlistSpots} waitlisted` : ""}
        {cancelledSpots ? ` · ${cancelledSpots} cancelled` : ""}
      </p>
      <p className="mt-1 truncate font-mono text-xs text-[var(--mute)]">{publicEventUrl(event.slug)}</p>

      <div className="card mt-8 p-6">
        <EventForm
          action={updateEventAction}
          submitLabel="Save event"
          showPublished
          error={error}
          values={{
            id: event.id,
            slug: event.slug,
            title: event.title,
            description: event.description,
            venue: event.venue,
            startsAt: toDatetimeLocal(event.startsAt),
            endsAt: toDatetimeLocal(event.endsAt),
            isNetworking: event.isNetworking,
            isPaid: event.isPaid,
            published: event.published,
            price: (event.priceCents / 100).toFixed(2),
            currency: event.currency,
            capacity: event.capacity,
            maxPerOrder: event.maxPerOrder,
            paymentInstructions: event.paymentInstructions,
            themeId: event.themeId,
            contactDetails: event.contactDetails,
          }}
        />
      </div>

      <h2 className="mt-12 font-serif text-3xl">Participants</h2>
      <p className="mt-1 text-sm text-[var(--mute)]">
        Grouped by the person who booked. Mark each name paid, or the whole group.
      </p>
      <BookingList rows={occupying} variant="participants" maxPerOrder={event.maxPerOrder} />

      <h2 className="mt-12 font-serif text-3xl">Waiting list</h2>
      <p className="mt-1 text-sm text-[var(--mute)]">
        Oldest first. Moving a group in does not have to respect the quota.
      </p>
      <BookingList rows={waitlist} variant="waitlist" maxPerOrder={event.maxPerOrder} />

      <h2 className="mt-12 font-serif text-3xl">Cancelled participants</h2>
      <p className="mt-1 text-sm text-[var(--mute)]">
        People who cancelled their booking. Payment records stay here so you can mark receipts and
        refunds.
      </p>
      <BookingList rows={cancelled} variant="cancelled" maxPerOrder={event.maxPerOrder} />
    </div>
  );
}

function BookingList({
  rows,
  variant,
  maxPerOrder,
}: {
  rows: {
    id: string;
    status: string;
    user: { name: string; email: string };
    spots: {
      id: string;
      name: string;
      isHolder: boolean;
      status: string;
      payment: {
        id: string;
        status: string;
        amountCents: number;
        currency: string;
        evidencePath: string | null;
        evidenceNote: string | null;
        refundNote: string | null;
        refundAmountCents: number | null;
      } | null;
    }[];
  }[];
  variant: "participants" | "waitlist" | "cancelled";
  maxPerOrder: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-4 text-[var(--mute)]">
        {variant === "waitlist"
          ? "No one is waiting."
          : variant === "cancelled"
            ? "No cancelled participants."
            : "No active participants."}
      </p>
    );
  }

  const cancelled = variant === "cancelled";
  const waitlist = variant === "waitlist";

  return (
    <div className="mt-6 grid gap-4">
      {rows.map((row) => {
        const spots = cancelled ? row.spots : row.spots.filter((s) => s.status !== "CANCELLED");
        const total = spots.reduce((sum, s) => sum + (s.payment?.amountCents ?? 0), 0);
        const currency = spots.find((s) => s.payment)?.payment?.currency ?? "hkd";
        const unpaid = spots.filter(
          (s) => s.payment && s.payment.status !== "PAID" && s.payment.status !== "REFUNDED",
        );
        return (
          <div key={row.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-serif text-xl">{row.user.name}</p>
                <p className="text-sm text-[var(--mute)]">{row.user.email}</p>
                <div className="mt-2">
                  <StatusPills registrationStatus={row.status} />
                </div>
              </div>
              <p className="text-sm">
                {total > 0 ? formatMoney(total, currency) : "Free"} · {spots.length}{" "}
                {spots.length === 1 ? "spot" : "spots"}
              </p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-[var(--mute)]">
                    <th className="py-1 pr-3 font-normal">Name</th>
                    <th className="py-1 pr-3 font-normal">Status</th>
                    <th className="py-1 pr-3 font-normal">Amount</th>
                    <th className="py-1 pr-3 font-normal">Evidence</th>
                    <th className="py-1 font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {spots.map((spot) => (
                    <tr key={spot.id} className="border-t border-[var(--line)] align-top">
                      <td className="py-2 pr-3">
                        {spot.name}
                        {spot.isHolder ? " · booker" : ""}
                      </td>
                      <td className="py-2 pr-3">
                        <StatusPills
                          registrationStatus={spot.status}
                          paymentStatus={spot.payment?.status}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        {spot.payment &&
                        spot.payment.status !== "PAID" &&
                        spot.payment.status !== "REFUNDED" ? (
                          <form action={updateSpotAmountAction} className="flex items-center gap-2">
                            <input type="hidden" name="paymentId" value={spot.payment.id} />
                            <input
                              className="field w-24"
                              name="amount"
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue={(spot.payment.amountCents / 100).toFixed(2)}
                            />
                            <button className="btn-line text-xs" type="submit">
                              Set
                            </button>
                          </form>
                        ) : spot.payment ? (
                          formatMoney(spot.payment.amountCents, spot.payment.currency)
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {spot.payment?.evidencePath ? (
                          <a
                            className="underline"
                            href={`/api/receipts/${spot.payment.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Receipt
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2">
                        {spot.payment &&
                        spot.payment.status !== "PAID" &&
                        spot.payment.status !== "REFUNDED" ? (
                          <div className="flex flex-wrap gap-2">
                            <form action={markPaidAction}>
                              <input type="hidden" name="paymentId" value={spot.payment.id} />
                              <input type="hidden" name="decision" value="paid" />
                              <button className="btn-gold" type="submit">
                                Mark paid
                              </button>
                            </form>
                            {spot.payment.status === "AWAITING_REVIEW" ||
                            spot.payment.status === "REJECTED" ? (
                              <form action={markPaidAction}>
                                <input type="hidden" name="paymentId" value={spot.payment.id} />
                                <input type="hidden" name="decision" value="reject" />
                                <button className="btn-line" type="submit">
                                  Reject
                                </button>
                              </form>
                            ) : null}
                          </div>
                        ) : null}
                        {spot.payment?.status === "PAID" ? (
                          <form action={markRefundedAction} className="flex flex-wrap gap-2">
                            <input type="hidden" name="paymentId" value={spot.payment.id} />
                            <input
                              className="field w-24"
                              name="refundAmount"
                              type="number"
                              step="0.01"
                              defaultValue={(spot.payment.amountCents / 100).toFixed(2)}
                            />
                            <button className="btn-line" type="submit">
                              Refund
                            </button>
                          </form>
                        ) : null}
                        {spot.payment?.status === "REFUNDED" ? (
                          <p className="text-xs text-[var(--mute)]">
                            Refunded{" "}
                            {formatMoney(
                              spot.payment.refundAmountCents ?? spot.payment.amountCents,
                              spot.payment.currency,
                            )}
                          </p>
                        ) : null}
                        {!cancelled && spot.payment?.status !== "PAID" && spots.length > 1 ? (
                          <form action={removeSpotHostAction} className="mt-2">
                            <input type="hidden" name="spotId" value={spot.id} />
                            <button className="text-xs text-red-800 underline" type="submit">
                              Remove
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-2">
              {!cancelled && spots.length < maxPerOrder ? (
                <form action={addSpotHostAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="registrationId" value={row.id} />
                  <div>
                    <label className="label">Add person</label>
                    <input className="field w-40" name="name" required placeholder="Name" />
                  </div>
                  <button className="btn-line" type="submit">
                    Add
                  </button>
                </form>
              ) : null}
              {unpaid.length > 1 ? (
                <form action={setGroupTotalAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="registrationId" value={row.id} />
                  <div>
                    <label className="label">Set group total</label>
                    <input
                      className="field w-28"
                      name="groupTotal"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                    />
                  </div>
                  <button className="btn-line" type="submit">
                    Split
                  </button>
                </form>
              ) : null}
              {waitlist ? (
                <form action={promoteFromWaitlistAction}>
                  <input type="hidden" name="registrationId" value={row.id} />
                  <button className="btn-gold" type="submit">
                    Move group to participants
                  </button>
                </form>
              ) : null}
              {unpaid.length > 1 ? (
                <form action={markGroupPaidAction}>
                  <input type="hidden" name="registrationId" value={row.id} />
                  <button className="btn-gold" type="submit">
                    Mark whole group paid
                  </button>
                </form>
              ) : unpaid.length === 1 ? (
                <form action={markGroupPaidAction}>
                  <input type="hidden" name="registrationId" value={row.id} />
                  <button className="btn-gold" type="submit">
                    Mark group paid
                  </button>
                </form>
              ) : null}
              {!cancelled ? (
                <form action={cancelAttendanceAction}>
                  <input type="hidden" name="registrationId" value={row.id} />
                  <button className="text-sm text-red-800 underline" type="submit">
                    Remove booking
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
