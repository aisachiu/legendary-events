import Link from "next/link";
import { redirect } from "next/navigation";
import { updateEventAction } from "@/app/actions/events";
import {
  cancelAttendanceAction,
  markPaidAction,
  markRefundedAction,
} from "@/app/actions/payments";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney, formatWhen, toDatetimeLocal } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canManageEvent } from "@/lib/roles";
import { StatusPills } from "@/components/Pills";

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

  const ledger = event.registrations.filter((r) => r.status !== "CANCELLED");

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
        {formatWhen(event.startsAt)} · {ledger.length} on the ledger
      </p>

      <form action={updateEventAction} className="card mt-8 grid gap-4 p-6 sm:grid-cols-2">
        <input type="hidden" name="id" value={event.id} />
        <div className="sm:col-span-2">
          <label className="label">Title</label>
          <input className="field" name="title" defaultValue={event.title} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea className="field min-h-28" name="description" defaultValue={event.description} />
        </div>
        <div>
          <label className="label">Venue</label>
          <input className="field" name="venue" defaultValue={event.venue} />
        </div>
        <div>
          <label className="label">Price (USD)</label>
          <input
            className="field"
            type="number"
            name="price"
            step="0.01"
            defaultValue={(event.priceCents / 100).toFixed(2)}
          />
        </div>
        <div>
          <label className="label">Starts</label>
          <input
            className="field"
            type="datetime-local"
            name="startsAt"
            defaultValue={toDatetimeLocal(event.startsAt)}
          />
        </div>
        <div>
          <label className="label">Ends</label>
          <input
            className="field"
            type="datetime-local"
            name="endsAt"
            defaultValue={toDatetimeLocal(event.endsAt)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isNetworking" defaultChecked={event.isNetworking} />
          Who&apos;s Going
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPaid" defaultChecked={event.isPaid} />
          Paid (receipt upload)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={event.published} />
          Published
        </label>
        <div className="sm:col-span-2">
          <label className="label">Payment instructions</label>
          <textarea
            className="field min-h-24"
            name="paymentInstructions"
            defaultValue={event.paymentInstructions ?? ""}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Payment image (QR, optional)</label>
          <input className="field" type="file" name="paymentImage" accept="image/*" />
          {event.paymentImagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/events/${event.slug}/pay-image`}
              alt=""
              className="mt-3 max-h-40 rounded-lg border border-[var(--line)]"
            />
          ) : null}
        </div>
        <button className="btn-gold w-fit" type="submit">
          Save event
        </button>
      </form>

      <h2 className="mt-12 font-serif text-3xl">Payment ledger</h2>
      <p className="mt-1 text-sm text-[var(--mute)]">
        Cancelled guests are hidden here. Mark paid, reject a receipt, refund, or remove a row.
      </p>
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
            {ledger.map((row) => (
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
                    {row.payment && row.payment.status !== "PAID" && row.payment.status !== "REFUNDED" ? (
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
        {ledger.length === 0 ? (
          <p className="mt-4 text-[var(--mute)]">No active signups.</p>
        ) : null}
      </div>
    </div>
  );
}
