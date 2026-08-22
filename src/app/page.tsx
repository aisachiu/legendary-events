import Link from "next/link";
import { Pill } from "@/components/Pills";
import { formatMoney, formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { formatSignupCount, OCCUPYING_STATUSES } from "@/lib/registrations";
import { eventBlurb } from "@/lib/storage";

export default async function HomePage() {
  const events = await prisma.event.findMany({
    where: { published: true },
    orderBy: { startsAt: "asc" },
    include: {
      _count: {
        select: {
          registrations: { where: { status: { in: [...OCCUPYING_STATUSES] } } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold-ink)]">
        Public rooms, private tables
      </p>
      <h1 className="mt-3 font-serif text-5xl leading-tight text-[var(--ink)] sm:text-6xl">
        Host something worth showing up for.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-[var(--mute)]">
        Create an event, take signups from anyone, collect payment receipts, and — for
        nights with Who&apos;s Going — open attendee cards only after someone is confirmed.
      </p>
      <div className="mt-10 grid gap-5">
        {events.map((event) => (
          <Link key={event.id} href={`/events/${event.slug}`} className="card p-6 hover:border-[var(--gold)]/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-3xl">{event.title}</h2>
                <p className="mt-1 text-[var(--mute)]">
                  {eventBlurb(event.description, event.summary)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {event.isNetworking ? <Pill>Who&apos;s Going</Pill> : <Pill tone="mute">Open</Pill>}
                {event.isPaid ? (
                  <Pill tone="gold">{formatMoney(event.priceCents, event.currency)}</Pill>
                ) : (
                  <Pill tone="ok">Free</Pill>
                )}
              </div>
            </div>
            <p className="mt-4 text-sm text-[var(--mute)]">
              {formatWhen(event.startsAt)} · {event.venue} ·{" "}
              {formatSignupCount(event._count.registrations, event.capacity)}
            </p>
          </Link>
        ))}
        {events.length === 0 ? (
          <p className="text-[var(--mute)]">No published events yet.</p>
        ) : null}
      </div>
    </div>
  );
}
