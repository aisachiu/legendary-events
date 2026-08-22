import Link from "next/link";
import { signupAction } from "@/app/actions/payments";
import { EventHtml } from "@/components/EventHtml";
import { Pill } from "@/components/Pills";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney, formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { eventIsFull, formatSignupCount, occupyingWhere } from "@/lib/registrations";
import { eventBlurb } from "@/lib/storage";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const user = await getCurrentUser();
  const event = await prisma.event.findUnique({
    where: { slug },
    include: { organizer: true },
  });
  if (!event || !event.published) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <p>That event is not public.</p>
      </div>
    );
  }

  const occupying = await prisma.registration.count({
    where: occupyingWhere(event.id),
  });
  const full = eventIsFull(occupying, event.capacity);

  const mine = user
    ? await prisma.registration.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: user.id } },
        include: { payment: true },
      })
    : null;

  const blurb = eventBlurb(event.description, event.summary);
  const showSignup = !mine || mine.status === "CANCELLED";

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1.2fr_0.8fr]">
      <article>
        <div className="flex flex-wrap gap-2">
          {event.isNetworking ? <Pill>Who&apos;s Going</Pill> : null}
          {event.isPaid ? (
            <Pill>{formatMoney(event.priceCents, event.currency)}</Pill>
          ) : (
            <Pill tone="ok">Free</Pill>
          )}
          {full ? <Pill tone="warn">Full</Pill> : null}
        </div>
        <h1 className="mt-4 font-serif text-5xl">{event.title}</h1>
        {blurb ? <p className="mt-3 text-lg text-[var(--mute)]">{blurb}</p> : null}
        <p className="mt-6 text-sm text-[var(--mute)]">
          {formatWhen(event.startsAt)} — {formatWhen(event.endsAt)}
          <br />
          {event.venue} · Hosted by {event.organizer.name} ·{" "}
          {formatSignupCount(occupying, event.capacity)}
        </p>
        <EventHtml html={event.description} />
        {event.isNetworking ? (
          <p className="mt-8 text-sm text-[var(--mute)]">
            Who&apos;s Going stays closed until your place is confirmed
            {event.isPaid ? " (after the host accepts your receipt)" : ""}.
          </p>
        ) : null}
      </article>

      <aside className="card h-fit p-6">
        {error ? <p className="mb-4 text-sm text-red-800">{error}</p> : null}
        {mine?.status === "CONFIRMED" ? (
          <div>
            <p className="font-serif text-2xl">You are in.</p>
            <p className="mt-2 text-sm text-[var(--mute)]">Your signup is confirmed.</p>
            <div className="mt-5 flex flex-col gap-2">
              <Link href={`/events/${slug}/confirmation`} className="btn-line">
                View confirmation
              </Link>
              {event.isNetworking ? (
                <Link href={`/events/${slug}/going`} className="btn-gold">
                  Who&apos;s Going
                </Link>
              ) : null}
            </div>
          </div>
        ) : mine?.status === "PENDING_PAYMENT" ? (
          <div>
            <p className="font-serif text-2xl">A spot opened — complete payment</p>
            <p className="mt-2 text-sm text-[var(--mute)]">
              Your name is held. Upload a receipt; the host marks you paid when it matches.
            </p>
            <Link href={`/events/${slug}/pay`} className="btn-gold mt-5">
              Go to payment
            </Link>
          </div>
        ) : mine?.status === "WAITLISTED" ? (
          <div>
            <p className="font-serif text-2xl">You are on the waitlist</p>
            <p className="mt-2 text-sm text-[var(--mute)]">
              The host can move you into a participant spot. You will only pay if this is a paid
              event and they promote you.
            </p>
            <Link href={`/events/${slug}/confirmation`} className="btn-line mt-5">
              View status
            </Link>
          </div>
        ) : showSignup ? (
          <form action={signupAction} className="space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <p className="font-serif text-2xl">{full ? "Join waitlist" : "Sign up"}</p>
            {mine?.status === "CANCELLED" ? (
              <p className="text-sm text-[var(--mute)]">This signup was cancelled. You can join again.</p>
            ) : null}
            {!user ? (
              <p className="text-sm text-[var(--mute)]">
                <Link className="underline" href={`/login?next=/events/${slug}`}>
                  Sign in with your phone or a social account
                </Link>{" "}
                first, then you can {full ? "join the waitlist" : "hold a place"}.
              </p>
            ) : (
              <p className="text-sm text-[var(--mute)]">Signing up as {user.name}.</p>
            )}
            {event.isNetworking ? (
              <>
                <div>
                  <label className="label">Preferred name (at the event)</label>
                  <input className="field" name="preferredName" defaultValue={user?.name ?? ""} />
                </div>
                <div>
                  <label className="label">Title / position</label>
                  <input className="field" name="titlePosition" />
                </div>
                <div>
                  <label className="label">Intro / bio</label>
                  <textarea
                    className="field min-h-24"
                    name="introBio"
                    placeholder="Write a sentence or two to introduce yourself!"
                  />
                </div>
                <div>
                  <label className="label">LinkedIn URL</label>
                  <input className="field" name="linkedinUrl" placeholder="https://" />
                </div>
              </>
            ) : null}
            {user ? (
              <button className="btn-gold w-full" type="submit">
                {full
                  ? "Join waitlist"
                  : event.isPaid
                    ? "Hold my place"
                    : "Confirm my place"}
              </button>
            ) : null}
          </form>
        ) : null}
      </aside>
    </div>
  );
}
