import Link from "next/link";
import { Pill } from "@/components/Pills";
import { formatMoney, formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { formatSignupCount, OCCUPYING_STATUSES } from "@/lib/registrations";

export default async function HomePage() {
  const events = await prisma.event.findMany({
    where: { visibility: "PUBLIC" },
    include: {
      channels: {
        orderBy: { createdAt: "asc" },
        include: {
          registrations: {
            select: {
              spots: {
                where: { status: { in: [...OCCUPYING_STATUSES] } },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  const listed = events
    .map((event) => {
      const channel = event.channels[0];
      if (!channel) return null;
      return { event, channel };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.channel.startsAt.getTime() - b.channel.startsAt.getTime());

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold-ink)]">
        Welcome
      </p>
      <h1 className="mt-3 font-serif text-5xl leading-tight text-[var(--ink)] sm:text-6xl">
        Legendary Events
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-[var(--mute)]">
        Events platforms - create events, get signups, track payments, and more.
      </p>
      <div className="mt-10 grid gap-5">
        {listed.map(({ event, channel }) => (
          <Link
            key={event.id}
            href={`/events/${channel.slug}`}
            className="card p-6 hover:border-[var(--gold)]/50"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-3xl">{event.title}</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {channel.isNetworking ? <Pill>Who&apos;s Going</Pill> : <Pill tone="mute">Open</Pill>}
                {channel.isPaid ? (
                  <Pill tone="gold">{formatMoney(channel.priceCents, channel.currency)}</Pill>
                ) : (
                  <Pill tone="ok">Free</Pill>
                )}
              </div>
            </div>
            <p className="mt-4 text-sm text-[var(--mute)]">
              {formatWhen(channel.startsAt)} · {channel.venue} ·{" "}
              {formatSignupCount(
                channel.registrations.reduce((n, r) => n + r.spots.length, 0),
                channel.capacity,
              )}
            </p>
          </Link>
        ))}
        {listed.length === 0 ? (
          <p className="text-[var(--mute)]">No published events yet.</p>
        ) : null}
      </div>
    </div>
  );
}
