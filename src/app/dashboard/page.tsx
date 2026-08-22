import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen, registrationLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { OCCUPYING_STATUSES } from "@/lib/registrations";
import { isSuperadmin } from "@/lib/roles";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>Sign in to see your events and tickets.</p>
        <Link className="btn-gold mt-4" href="/login?next=/dashboard">
          Sign in
        </Link>
      </div>
    );
  }

  const events = await prisma.event.findMany({
    where: isSuperadmin(user) ? undefined : { organizerId: user.id },
    orderBy: { startsAt: "asc" },
    include: {
      registrations: {
        include: {
          spots: { include: { payment: true } },
        },
      },
    },
  });

  const mine = await prisma.registration.findMany({
    where: { userId: user.id },
    include: { event: true, spots: { include: { payment: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold-ink)]">Dashboard</p>
          <h1 className="mt-2 font-serif text-4xl">Hello, {user.name}</h1>
        </div>
        <Link href="/dashboard/events/new" className="btn-gold">
          New event
        </Link>
      </div>
      {error === "host" ? (
        <p className="mt-4 text-sm text-red-800">Sign in to create events.</p>
      ) : null}

      <section className="mt-10 grid gap-4">
        {events.map((event) => {
          const occupying = event.registrations.reduce(
            (n, r) =>
              n + r.spots.filter((s) => (OCCUPYING_STATUSES as readonly string[]).includes(s.status)).length,
            0,
          );
          const pending = event.registrations.reduce(
            (n, r) =>
              n + r.spots.filter((s) => s.payment?.status === "AWAITING_REVIEW").length,
            0,
          );
          const waitlisted = event.registrations.reduce(
            (n, r) => n + r.spots.filter((s) => s.status === "WAITLISTED").length,
            0,
          );
          const occupancy =
            event.capacity != null ? `${occupying} / ${event.capacity} in` : `${occupying} in`;
          return (
            <Link
              key={event.id}
              href={`/dashboard/events/${event.id}`}
              className="card flex flex-wrap items-center justify-between gap-3 p-5"
            >
              <div>
                <h2 className="font-serif text-2xl">{event.title}</h2>
                <p className="text-sm text-[var(--mute)]">
                  {formatWhen(event.startsAt)} · {occupancy}
                  {waitlisted ? ` · ${waitlisted} waitlisted` : ""}
                  {pending ? ` · ${pending} evidence to review` : ""}
                </p>
              </div>
              <span className="text-sm underline">Ledger</span>
            </Link>
          );
        })}
        {events.length === 0 ? (
          <p className="text-[var(--mute)]">No events yet. Publish your first night.</p>
        ) : null}
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Your tickets</h2>
        <div className="mt-4 grid gap-3">
          {mine.map((row) => (
            <Link key={row.id} href={`/events/${row.event.slug}`} className="card p-5">
              <p className="font-serif text-xl">{row.event.title}</p>
              <p className="text-sm text-[var(--mute)]">
                {registrationLabel[row.status] ?? row.status}
                {row.spots.length > 1 ? ` · ${row.spots.length} spots` : ""}
              </p>
            </Link>
          ))}
          {mine.length === 0 ? (
            <p className="text-[var(--mute)]">You have not signed up for anything yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
