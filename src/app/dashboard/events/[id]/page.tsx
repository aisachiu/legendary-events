import Link from "next/link";
import { redirect } from "next/navigation";
import { updateEventAction } from "@/app/actions/events";
import {
  cancelAttendanceAction,
  markPaidAction,
  markRefundedAction,
  promoteFromWaitlistAction,
} from "@/app/actions/payments";
import { EventForm } from "@/components/EventForm";
import { StatusPills } from "@/components/Pills";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney, formatWhen, toDatetimeLocal } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { OCCUPYING_STATUSES } from "@/lib/registrations";
import { canManageEvent } from "@/lib/roles";

type DeskRegistration = {
  id: string;
  status: string;
  preferredName: string | null;
  user: { name: string; email: string };
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
};

function GuestTable({
  rows,
  waitlist,
}: {
  rows: DeskRegistration[];
  waitlist?: boolean;
}) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--line)] text-[var(--mute)]">
            <th className="py-2 pr-3 font-normal">Guest</th>
            <th className="py-2 pr-3 font-normal">Status</th>
            <th className="py-2 pr-3 font-normal">Amount</th>
            <th className="py-2 pr-3 font-normal">Evidence</th>
            <th className="py-2 font-normal">Host action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--line)] align-top">
              <td className="py-3 pr-3">
                <div>{row.preferredName || row.user.name}</div>
                <div className="text-[var(--mute)]">{row.user.email}</div>
              </td>
              <td className="py-3 pr-3">
                <StatusPills
                  registrationStatus={row.status}
                  paymentStatus={row.payment?.status}
                />
                {row.payment?.refundNote ? (
                  <p className="mt-1 text-xs text-[var(--mute)]">
                    Refund: {row.payment.refundNote}
                    {row.payment.refundAmountCents != null
                      ? ` (${formatMoney(row.payment.refundAmountCents, row.payment.currency)})`
                      : ""}
                  </p>
                ) : null}
              </td>
              <td className="py-3 pr-3">
                {row.payment
                  ? formatMoney(row.payment.amountCents, row.payment.currency)
                  : "Free"}
              </td>
              <td className="py-3 pr-3">
                {row.payment?.evidencePath ? (
                  <div>
                    <a
                      className="underline"
                      href={`/api/receipts/${row.payment.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View receipt
                    </a>
                    {row.payment.evidenceNote ? (
                      <p className="mt-1 text-[var(--mute)]">{row.payment.evidenceNote}</p>
                    ) : null}
                  </div>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-3">
                <div className="flex flex-col gap-2">
                  {waitlist ? (
                    <form action={promoteFromWaitlistAction}>
                      <input type="hidden" name="registrationId" value={row.id} />
                      <button className="btn-gold" type="submit">
                        Move to participants
                      </button>
                    </form>
                  ) : null}
                  {row.payment &&
                  row.payment.status !== "PAID" &&
                  row.payment.status !== "REFUNDED" ? (
                    <div className="flex flex-wrap gap-2">
                      <form action={markPaidAction}>
                        <input type="hidden" name="paymentId" value={row.payment.id} />
                        <input type="hidden" name="decision" value="paid" />
                        <button className="btn-gold" type="submit">
                          Mark as paid
                        </button>
                      </form>
                      {row.payment.status === "AWAITING_REVIEW" ||
                      row.payment.status === "REJECTED" ? (
                        <form action={markPaidAction}>
                          <input type="hidden" name="paymentId" value={row.payment.id} />
                          <input type="hidden" name="decision" value="reject" />
                          <button className="btn-line" type="submit">
                            Reject
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                  {row.payment && row.payment.status === "PAID" ? (
                    <form action={markRefundedAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="paymentId" value={row.payment.id} />
                      <input
                        className="field w-28"
                        name="refundAmount"
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        defaultValue={(row.payment.amountCents / 100).toFixed(2)}
                      />
                      <input className="field w-40" name="refundNote" placeholder="Refund note" />
                      <button className="btn-line" type="submit">
                        Mark refunded
                      </button>
                    </form>
                  ) : null}
                  <form action={cancelAttendanceAction}>
                    <input type="hidden" name="registrationId" value={row.id} />
                    <button className="text-sm text-red-800 underline" type="submit">
                      Remove from ledger
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="mt-4 text-[var(--mute)]">
          {waitlist ? "No one is waiting." : "No active participants."}
        </p>
      ) : null}
    </div>
  );
}

export default async function EventDeskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      registrations: {
        include: { user: true, payment: true },
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

  const occupying = event.registrations.filter((r) =>
    (OCCUPYING_STATUSES as readonly string[]).includes(r.status),
  );
  const waitlist = event.registrations.filter((r) => r.status === "WAITLISTED");
  const occupancyLabel =
    event.capacity != null
      ? `${occupying.length} / ${event.capacity} participants (you can exceed quota)`
      : `${occupying.length} participants`;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link href="/dashboard" className="text-sm text-[var(--mute)]">
        ← Host desk
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-4xl">{event.title}</h1>
        <Link href={`/events/${event.slug}`} className="btn-line">
          Public page
        </Link>
      </div>
      <p className="mt-2 text-sm text-[var(--mute)]">
        {formatWhen(event.startsAt)} · {occupancyLabel}
        {waitlist.length ? ` · ${waitlist.length} waitlisted` : ""}
      </p>

      <div className="card mt-8 p-6">
        <EventForm
          action={updateEventAction}
          submitLabel="Save event"
          showPublished
          values={{
            id: event.id,
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
            paymentInstructions: event.paymentInstructions,
            paymentImageSrc: event.paymentImagePath
              ? `/api/events/${event.slug}/pay-image`
              : null,
          }}
        />
      </div>

      <h2 className="mt-12 font-serif text-3xl">Participants</h2>
      <p className="mt-1 text-sm text-[var(--mute)]">
        Confirmed guests and people holding a place while payment is outstanding.
      </p>
      <GuestTable rows={occupying} />

      <h2 className="mt-12 font-serif text-3xl">Waiting list</h2>
      <p className="mt-1 text-sm text-[var(--mute)]">
        Oldest first. Moving someone in does not have to respect the quota.
      </p>
      <GuestTable rows={waitlist} waitlist />
    </div>
  );
}
