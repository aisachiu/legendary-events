import Link from "next/link";
import { signupAction } from "@/app/actions/payments";
import { AuthForm } from "@/components/AuthForm";
import { EventContactBox } from "@/components/EventContactBox";
import { EventHtml } from "@/components/EventHtml";
import { PartyFields, QuotaNotice } from "@/components/PartyFields";
import { Pill } from "@/components/Pills";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney, formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canSeeEventContact, eventIsFull, formatSignupCount, occupyingSpotWhere } from "@/lib/registrations";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; remaining?: string; wanted?: string }>;
}) {
  const { slug } = await params;
  const { error, remaining, wanted } = await searchParams;
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

  const occupying = await prisma.spot.count({
    where: occupyingSpotWhere(event.id),
  });
  const full = eventIsFull(occupying, event.capacity);

  const mine = user
    ? await prisma.registration.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: user.id } },
        include: { spots: { include: { payment: true } } },
      })
    : null;

  const showSignup = !mine || mine.status === "CANCELLED";
  const priceLabel = event.isPaid
    ? `${formatMoney(event.priceCents, event.currency)} per person`
    : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1.2fr_0.8fr]">
      <article>
        <div className="flex flex-wrap gap-2">
          {event.isNetworking ? <Pill>Who&apos;s Going</Pill> : null}
          {event.isPaid ? (
            <Pill>{priceLabel}</Pill>
          ) : (
            <Pill tone="ok">Free</Pill>
          )}
          {full ? <Pill tone="warn">Full</Pill> : null}
        </div>
        <h1 className="mt-4 font-serif text-5xl">{event.title}</h1>
        <p className="mt-6 text-sm text-[var(--mute)]">
          {formatWhen(event.startsAt)} — {formatWhen(event.endsAt)}
          <br />
          {event.venue} · Hosted by {event.organizer.name} ·{" "}
          {formatSignupCount(occupying, event.capacity)}
        </p>
        <EventHtml html={event.description} />
        {canSeeEventContact(user, event, mine) && event.contactDetails ? (
          <EventContactBox details={event.contactDetails} />
        ) : null}
        {event.isNetworking ? (
          <p className="mt-8 text-sm text-[var(--mute)]">
            Who&apos;s Going stays closed until your place is confirmed
            {event.isPaid ? " (after the host accepts your receipt)" : ""}.
          </p>
        ) : null}
      </article>

      <aside className="card h-fit p-6">
        {error === "quota" && remaining && wanted ? (
          <div className="mb-4">
            <QuotaNotice remaining={Number(remaining)} wanted={Number(wanted)} />
          </div>
        ) : error === "party" ? (
          <p className="mb-4 text-sm text-red-800">Check names and the max spots for this event.</p>
        ) : error ? (
          <p className="mb-4 text-sm text-red-800">{error}</p>
        ) : null}
        {mine?.status === "CONFIRMED" ? (
          <div>
            <p className="font-serif text-2xl">You are in.</p>
            <p className="mt-2 text-sm text-[var(--mute)]">
              {mine.spots.filter((s) => s.status !== "CANCELLED").length} named{" "}
              {mine.spots.filter((s) => s.status !== "CANCELLED").length === 1 ? "spot" : "spots"}.
            </p>
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
            <p className="font-serif text-2xl">Complete Payment to Confirm Your Spot</p>
            <p className="mt-2 text-sm text-[var(--mute)]">
              Total due:{" "}
              {formatMoney(
                mine.spots
                  .filter((s) => s.payment && s.payment.status !== "PAID" && s.payment.status !== "REFUNDED")
                  .reduce((sum, s) => sum + (s.payment?.amountCents ?? 0), 0),
                event.currency,
              )}
              . You can upload payment evidence here or directly inform the host.
            </p>
            <Link href={`/events/${slug}/pay`} className="btn-gold mt-5">
              Go to payment
            </Link>
          </div>
        ) : mine?.status === "WAITLISTED" ? (
          <div>
            <p className="font-serif text-2xl">You are on the waitlist</p>
            <p className="mt-2 text-sm text-[var(--mute)]">
              The host can move your group into participant spots. You will only pay if this is a
              paid event and they promote you.
            </p>
            <Link href={`/events/${slug}/confirmation`} className="btn-line mt-5">
              View status
            </Link>
          </div>
        ) : showSignup ? (
          <div className="space-y-3">
            <p className="font-serif text-2xl">{full ? "Join waitlist" : "Sign up"}</p>
            {mine?.status === "CANCELLED" ? (
              <p className="text-sm text-[var(--mute)]">This signup was cancelled. You can join again.</p>
            ) : null}
            {!user ? (
              <>
                <p className="text-sm text-[var(--mute)]">
                  Sign in or create an account here, then you can{" "}
                  {full ? "join the waitlist" : "hold a place"}. Enter your email first — we&apos;ll
                  ask for a password (and your name if you&apos;re new).
                </p>
                {process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID ? (
                  <AuthForm next={`/events/${slug}`} variant="compact" />
                ) : (
                  <p className="text-sm text-red-800">
                    Sign-in is not configured yet. Set{" "}
                    <code>NEXT_PUBLIC_DESCOPE_PROJECT_ID</code> and restart.
                  </p>
                )}
              </>
            ) : (
              <form action={signupAction} className="space-y-3">
                <input type="hidden" name="slug" value={slug} />
                <p className="text-sm text-[var(--mute)]">Signing up as {user.name}.</p>
                <PartyFields
                  maxPerOrder={event.maxPerOrder}
                  defaultHolder={user.name}
                  requireHolderName
                  showGoingOptIn={event.isNetworking}
                />
                {event.isNetworking ? (
                  <>
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
                <button className="btn-gold w-full" type="submit">
                  {full
                    ? "Join waitlist"
                    : event.isPaid
                      ? "Hold my place"
                      : "Confirm my place"}
                </button>
              </form>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
