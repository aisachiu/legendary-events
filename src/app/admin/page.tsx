import { redirect } from "next/navigation";
import { deleteEventAction, updateEventAction } from "@/app/actions/events";
import {
  updatePaymentAdminAction,
  updateRegistrationAdminAction,
  updateUserAdminAction,
} from "@/app/actions/admin";
import { markPaidAction } from "@/app/actions/payments";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney, formatWhen, toDatetimeLocal } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { isSuperadmin } from "@/lib/roles";
import { StatusPills } from "@/components/Pills";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isSuperadmin(user)) redirect("/dashboard");
  const { error } = await searchParams;

  const [users, events, registrations, payments] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.event.findMany({
      orderBy: { startsAt: "asc" },
      include: { organizer: true },
    }),
    prisma.registration.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: true, event: true, payment: true },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        registration: { include: { user: true, event: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold-ink)]">Superadmin</p>
      <h1 className="mt-2 font-serif text-4xl">All records</h1>
      <p className="mt-2 text-sm text-[var(--mute)]">
        Users, events, registrations, and payments. Change anything here.
      </p>
      {error === "last-admin" ? (
        <p className="mt-4 text-sm text-red-800">You cannot demote the last superadmin.</p>
      ) : null}

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Users ({users.length})</h2>
        <div className="mt-4 grid gap-4">
          {users.map((row) => (
            <form key={row.id} action={updateUserAdminAction} className="card grid gap-3 p-4 sm:grid-cols-5">
              <input type="hidden" name="id" value={row.id} />
              <div>
                <label className="label">Name</label>
                <input className="field" name="name" defaultValue={row.name} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="field" name="email" defaultValue={row.email} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="field" name="role" defaultValue={row.role}>
                  <option value="ATTENDEE">ATTENDEE</option>
                  <option value="ORGANIZER">ORGANIZER</option>
                  <option value="SUPERADMIN">SUPERADMIN</option>
                </select>
              </div>
              <div>
                <label className="label">New password</label>
                <input className="field" name="password" type="password" minLength={8} placeholder="Leave blank" />
              </div>
              <div className="flex items-end">
                <button className="btn-gold" type="submit">
                  Save
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Events ({events.length})</h2>
        <div className="mt-4 grid gap-6">
          {events.map((event) => (
            <div key={event.id} className="card p-5">
              <p className="text-sm text-[var(--mute)]">
                Host {event.organizer.name} ({event.organizer.email}) · {formatWhen(event.startsAt)}
              </p>
              <form action={updateEventAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={event.id} />
                <input type="hidden" name="next" value="/admin" />
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
                  <textarea className="field min-h-24" name="description" defaultValue={event.description} />
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
                    step="0.01"
                    name="price"
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
                  Networking
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isPaid" defaultChecked={event.isPaid} />
                  Paid
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="published" defaultChecked={event.published} />
                  Published
                </label>
                <button className="btn-gold w-fit" type="submit">
                  Save event
                </button>
              </form>
              <form action={deleteEventAction} className="mt-3">
                <input type="hidden" name="id" value={event.id} />
                <button className="btn-line text-red-800" type="submit">
                  Delete event
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Registrations ({registrations.length})</h2>
        <div className="mt-4 grid gap-4">
          {registrations.map((row) => (
            <form key={row.id} action={updateRegistrationAdminAction} className="card grid gap-3 p-4">
              <input type="hidden" name="id" value={row.id} />
              <p className="text-sm text-[var(--mute)]">
                {row.user.name} ({row.user.email}) · {row.event.title}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Status</label>
                  <select className="field" name="status" defaultValue={row.status}>
                    <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
                <div>
                  <label className="label">Headline</label>
                  <input className="field" name="bioHeadline" defaultValue={row.bioHeadline ?? ""} />
                </div>
                <div>
                  <label className="label">Company</label>
                  <input className="field" name="bioCompany" defaultValue={row.bioCompany ?? ""} />
                </div>
                <div>
                  <label className="label">LinkedIn</label>
                  <input className="field" name="bioLinkedin" defaultValue={row.bioLinkedin ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">About</label>
                  <textarea className="field min-h-20" name="bioAbout" defaultValue={row.bioAbout ?? ""} />
                </div>
              </div>
              <button className="btn-gold w-fit" type="submit">
                Save registration
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Payments ({payments.length})</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--mute)]">
                <th className="py-2 pr-3 font-normal">Guest / event</th>
                <th className="py-2 pr-3 font-normal">Amount</th>
                <th className="py-2 pr-3 font-normal">Evidence</th>
                <th className="py-2 font-normal">Manage</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((row) => (
                <tr key={row.id} className="border-b border-[var(--line)] align-top">
                  <td className="py-3 pr-3">
                    <div>{row.registration.user.name}</div>
                    <div className="text-[var(--mute)]">{row.registration.event.title}</div>
                    <div className="mt-1">
                      <StatusPills
                        registrationStatus={row.registration.status}
                        paymentStatus={row.status}
                      />
                    </div>
                  </td>
                  <td className="py-3 pr-3">{formatMoney(row.amountCents, row.currency)}</td>
                  <td className="py-3 pr-3">
                    {row.evidencePath ? (
                      <a className="underline" href={row.evidencePath} target="_blank" rel="noreferrer">
                        View file
                      </a>
                    ) : (
                      "—"
                    )}
                    {row.evidenceNote ? <p className="mt-1 text-[var(--mute)]">{row.evidenceNote}</p> : null}
                  </td>
                  <td className="py-3">
                    <form action={updatePaymentAdminAction} className="mb-2 flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={row.id} />
                      <select className="field w-auto" name="status" defaultValue={row.status}>
                        <option value="UNPAID">UNPAID</option>
                        <option value="AWAITING_REVIEW">AWAITING_REVIEW</option>
                        <option value="PAID">PAID</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                      <input
                        className="field w-40"
                        name="evidenceNote"
                        defaultValue={row.evidenceNote ?? ""}
                        placeholder="Note"
                      />
                      <button className="btn-line" type="submit">
                        Save
                      </button>
                    </form>
                    {row.registration.status !== "CONFIRMED" ? (
                      <div className="flex gap-2">
                        <form action={markPaidAction}>
                          <input type="hidden" name="paymentId" value={row.id} />
                          <input type="hidden" name="decision" value="paid" />
                          <input type="hidden" name="next" value="/admin" />
                          <button className="btn-gold" type="submit">
                            Mark as paid
                          </button>
                        </form>
                        <form action={markPaidAction}>
                          <input type="hidden" name="paymentId" value={row.id} />
                          <input type="hidden" name="decision" value="reject" />
                          <input type="hidden" name="next" value="/admin" />
                          <button className="btn-line" type="submit">
                            Reject
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
