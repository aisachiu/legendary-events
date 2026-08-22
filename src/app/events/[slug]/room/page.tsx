import Link from "next/link";
import { saveBioAction } from "@/app/actions/payments";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function RoomPage({
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
        <p>This event does not have a networking room.</p>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>Sign in after you are confirmed to see bios.</p>
        <Link className="btn-gold mt-4" href={`/login?next=/events/${slug}/room`}>
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
        <p className="font-serif text-3xl">The room is still closed for you.</p>
        <p className="mt-3 text-[var(--mute)]">
          Bios unlock after signup is confirmed
          {event.isPaid ? ", including when the host marks an outside payment as paid" : ""}.
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
    <div className="mx-auto max-w-4xl px-5 py-12">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold-ink)]">Networking room</p>
      <h1 className="mt-2 font-serif text-4xl">{event.title}</h1>
      <p className="mt-2 text-[var(--mute)]">
        Confirmed guests only. {attendees.length} in the room.
      </p>

      <form action={saveBioAction} className="card mt-8 grid gap-3 p-6 sm:grid-cols-2">
        <input type="hidden" name="slug" value={slug} />
        <p className="font-serif text-2xl sm:col-span-2">Your bio</p>
        <div>
          <label className="label">Headline</label>
          <input className="field" name="bioHeadline" defaultValue={mine.bioHeadline ?? ""} />
        </div>
        <div>
          <label className="label">Company / project</label>
          <input className="field" name="bioCompany" defaultValue={mine.bioCompany ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">About</label>
          <textarea className="field min-h-24" name="bioAbout" defaultValue={mine.bioAbout ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">LinkedIn or site</label>
          <input className="field" name="bioLinkedin" defaultValue={mine.bioLinkedin ?? ""} />
        </div>
        <button className="btn-gold w-fit" type="submit">
          Save bio
        </button>
      </form>

      <div className="mt-10 grid gap-4">
        {attendees.map((row) => (
          <article key={row.id} className="card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-2xl">{row.user.name}</h2>
              {row.bioCompany ? (
                <p className="text-sm text-[var(--mute)]">{row.bioCompany}</p>
              ) : null}
            </div>
            {row.bioHeadline ? <p className="mt-1">{row.bioHeadline}</p> : null}
            {row.bioAbout ? (
              <p className="mt-3 whitespace-pre-wrap text-[var(--mute)]">{row.bioAbout}</p>
            ) : (
              <p className="mt-3 text-sm text-[var(--mute)]">No bio yet.</p>
            )}
            {row.bioLinkedin ? (
              <a
                className="mt-3 inline-block text-sm underline"
                href={row.bioLinkedin}
                target="_blank"
                rel="noreferrer"
              >
                {row.bioLinkedin}
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
