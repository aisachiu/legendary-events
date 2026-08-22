import Link from "next/link";
import { redirect } from "next/navigation";
import { updateEventAction } from "@/app/actions/events";
import { markPaidAction } from "@/app/actions/payments";
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
        {formatWhen(event.startsAt)} · {event.registrations.length} signups
      </p>

      <form action={updateEventAction} className="card mt-8 grid gap-4 p-6 sm:grid-cols-2">
        <input type="hidden" name="id" value={event.id} />
        <div className="sm:col-span-2">
          <label className="label">Title</label>
          <input className="field" name="title" defaultValue={event.title} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Summary</label>
          <input className="field" name="summary" defaultValue={event.summary} />
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
          Networking room
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPaid" defaultChecked={event.isPaid} />
          Paid (receipt upload)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={event.published} />
          Published
        </label>
        <button className="btn-gold w-fit" type="submit">
          Save event
        </button>
      </form>

      <h2 className="mt-12 font-serif text-3xl">Payment ledger</h2>
      <p className="mt-1 text-sm text-[var(--mute)]">
        Guests pay off-platform and upload proof. Mark a row paid when the receipt matches.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-[var(--mute)]">
              <th className="py-2 pr-3 font-normal">Guest</th>
              <th className="py-2 pr-3 font-normal">Status</th>
              <th className="py-2 pr-3 font-normal">Method</th>
              <th className="py-2 pr-3 font-normal">Amount</th>
              <th className="py-2 pr-3 font-normal">Evidence</th>
              <th className="py-2 font-normal">Host action</th>
            </tr>
          </thead>
          <tbody>
            {event.registrations.map((row) => (
              <tr key={row.id} className="border-b border-[var(--line)] align-top">
                <td className="py-3 pr-3">
                  <div>{row.user.name}</div>
                  <div className="text-[var(--mute)]">{row.user.email}</div>
                </td>
                <td className="py-3 pr-3">
                  <StatusPills
                    registrationStatus={row.status}
                    paymentStatus={row.payment?.status}
                  />
                </td>
                <td className="py-3 pr-3">{row.payment?.method ?? "—"}</td>
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
                        href={row.payment.evidencePath}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View file
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
                  {row.payment && row.status !== "CONFIRMED" ? (
                    <div className="flex flex-wrap gap-2">
                      <form action={markPaidAction}>
                        <input type="hidden" name="paymentId" value={row.payment.id} />
                        <input type="hidden" name="decision" value="paid" />
                        <button className="btn-gold" type="submit">
                          Mark as paid
                        </button>
                      </form>
                      {row.payment.status === "AWAITING_REVIEW" ? (
                        <form action={markPaidAction}>
                          <input type="hidden" name="paymentId" value={row.payment.id} />
                          <input type="hidden" name="decision" value="reject" />
                          <button className="btn-line" type="submit">
                            Reject
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {event.registrations.length === 0 ? (
          <p className="mt-4 text-[var(--mute)]">No signups yet.</p>
        ) : null}
      </div>
    </div>
  );
}
