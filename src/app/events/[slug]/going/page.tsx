import Link from "next/link";
import { saveBioAction } from "@/app/actions/payments";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function GoingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event?.isNetworking) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>This event does not have a Who&apos;s Going list.</p>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>Sign in after you are confirmed to see who is going.</p>
        <Link className="btn-gold mt-4" href={`/login?next=/events/${slug}/going`}>
          Sign in
        </Link>
      </div>
    );
  }

  const mine = await prisma.registration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
  });
  if (!mine || mine.status !== "CONFIRMED") {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p className="font-serif text-3xl">Who&apos;s Going is still closed for you.</p>
        <p className="mt-3 text-[var(--mute)]">
          The list unlocks after signup is confirmed
          {event.isPaid ? ", including when the host marks your receipt as paid" : ""}.
        </p>
        <Link className="btn-gold mt-6" href={`/events/${slug}`}>
          Back to the event
        </Link>
      </div>
    );
  }

  const attendees = await prisma.registration.findMany({
    where: { eventId: event.id, status: "CONFIRMED" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold-ink)]">Who&apos;s Going</p>
      <h1 className="mt-2 font-serif text-4xl">{event.title}</h1>
      <p className="mt-2 text-[var(--mute)]">
        Confirmed guests only. {attendees.length} going.
      </p>

      <form action={saveBioAction} className="card mt-8 grid gap-3 p-6 sm:grid-cols-2">
        <input type="hidden" name="slug" value={slug} />
        <p className="font-serif text-2xl sm:col-span-2">Your card</p>
        <div>
          <label className="label">Preferred name (at the event)</label>
          <input
            className="field"
            name="preferredName"
            defaultValue={mine.preferredName ?? user.name}
          />
        </div>
        <div>
          <label className="label">Title / position</label>
          <input className="field" name="titlePosition" defaultValue={mine.titlePosition ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Intro / bio</label>
          <textarea
            className="field min-h-24"
            name="introBio"
            placeholder="Write a sentence or two to introduce yourself!"
            defaultValue={mine.introBio ?? ""}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">LinkedIn URL</label>
          <input className="field" name="linkedinUrl" defaultValue={mine.linkedinUrl ?? ""} />
        </div>
        <button className="btn-gold w-fit" type="submit">
          Save
        </button>
      </form>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {attendees.map((row) => {
          const display = row.preferredName || row.user.name;
          return (
            <article key={row.id} className="card p-4">
              <h2 className="font-serif text-xl leading-tight">{display}</h2>
              {row.titlePosition ? (
                <p className="mt-1 text-sm text-[var(--mute)]">{row.titlePosition}</p>
              ) : null}
              {row.introBio ? (
                <p className="mt-2 line-clamp-4 text-sm">{row.introBio}</p>
              ) : (
                <p className="mt-2 text-sm text-[var(--mute)]">No intro yet.</p>
              )}
              {row.linkedinUrl ? (
                <a
                  className="mt-2 inline-block text-sm underline"
                  href={row.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </a>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
