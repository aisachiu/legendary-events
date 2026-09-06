import Link from "next/link";
import { cancelAttendanceAction, updatePartyAction } from "@/app/actions/payments";
import { EventContactBox } from "@/components/EventContactBox";
import { PartyFields, QuotaNotice } from "@/components/PartyFields";
import { StatusPills } from "@/components/Pills";
import { getCurrentUser } from "@/lib/auth";
import { getChannelBySlug } from "@/lib/channels";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canSeeEventContact } from "@/lib/registrations";

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; remaining?: string; wanted?: string }>;
}) {
  const { slug } = await params;
  const { error, remaining, wanted } = await searchParams;
  const user = await getCurrentUser();
  const channel = await getChannelBySlug(slug);
  if (!channel || !user) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>Sign in to see your confirmation.</p>
      </div>
    );
  }

  const registration = await prisma.registration.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId: user.id } },
    include: { spots: { include: { payment: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!registration) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>No signup on file.</p>
      </div>
    );
  }

  const activeSpots = registration.spots.filter((s) => s.status !== "CANCELLED");
  const dueCents = activeSpots
    .filter((s) => s.payment && s.payment.status !== "PAID" && s.payment.status !== "REFUNDED")
    .reduce((sum, s) => sum + (s.payment?.amountCents ?? 0), 0);
  const confirmed = registration.status === "CONFIRMED";
  const waitlisted = registration.status === "WAITLISTED";
  const waiting = activeSpots.some((s) => s.payment?.status === "AWAITING_REVIEW") && !confirmed;
  const holder = activeSpots.find((s) => s.isHolder);
  const guests = activeSpots.filter((s) => !s.isHolder);

  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <h1 className="font-serif text-4xl">
        {registration.status === "CANCELLED"
          ? "Signup cancelled"
          : confirmed
            ? "You are confirmed"
            : waitlisted
              ? "You are on the waitlist"
              : waiting
                ? "Evidence is with the host"
                : "Almost in"}
      </h1>
      <p className="mt-3 text-[var(--mute)]">{channel.event.title}</p>
      <div className="mt-4">
        <StatusPills registrationStatus={registration.status} />
      </div>
      <ul className="mt-6 space-y-1 text-sm">
        {activeSpots.map((spot) => (
          <li key={spot.id}>
            {spot.name}
            {spot.isHolder ? " (you)" : ""}
            {spot.payment
              ? ` · ${formatMoney(spot.payment.amountCents, spot.payment.currency)} · ${spot.payment.status}`
              : ` · ${spot.status}`}
          </li>
        ))}
      </ul>
      {channel.isPaid && dueCents > 0 ? (
        <p className="mt-4 text-sm">
          Total due (you are the account holder):{" "}
          <strong>{formatMoney(dueCents, channel.currency)}</strong>
        </p>
      ) : null}
      {waitlisted ? (
        <p className="mt-6 text-sm leading-6 text-[var(--mute)]">
          The event is full or your group is waitlisted together. The host can move you in. You
          will not be asked to pay until then.
        </p>
      ) : null}
      {waiting ? (
        <p className="mt-6 text-sm leading-6 text-[var(--mute)]">
          The host will open this once they match your upload. You will not see Who&apos;s
          Going until then.
        </p>
      ) : null}

      {canSeeEventContact(user, channel.event, channel, registration) && channel.contactDetails ? (
        <EventContactBox details={channel.contactDetails} />
      ) : null}

      {registration.status !== "CANCELLED" && channel.maxPerOrder > 0 ? (
        <form action={updatePartyAction} className="card mt-8 space-y-3 p-5">
          <input type="hidden" name="slug" value={slug} />
          <p className="font-serif text-2xl">People in your booking</p>
          {error === "quota" && remaining && wanted ? (
            <QuotaNotice remaining={Number(remaining)} wanted={Number(wanted)} />
          ) : error === "party" ? (
            <p className="text-sm text-red-800">Stay within {channel.maxPerOrder} names.</p>
          ) : null}
          <PartyFields
            maxPerOrder={channel.maxPerOrder}
            defaultHolder={holder?.name ?? user.name}
            defaultGuests={guests.map((g) => g.name)}
            defaultShowOnGoing={activeSpots.map((s) => s.showOnGoing)}
            requireHolderName
            showGoingOptIn={channel.isNetworking}
          />
          <button className="btn-gold" type="submit">
            Save names
          </button>
        </form>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/events/${slug}`} className="btn-line">
          Event page
        </Link>
        {confirmed && channel.isNetworking ? (
          <Link href={`/events/${slug}/going`} className="btn-gold">
            Who&apos;s Going
          </Link>
        ) : null}
        {!confirmed &&
        !waitlisted &&
        channel.isPaid &&
        registration.status !== "CANCELLED" ? (
          <Link href={`/events/${slug}/pay`} className="btn-gold">
            Upload receipt
          </Link>
        ) : null}
      </div>
      {registration.status !== "CANCELLED" ? (
        <form action={cancelAttendanceAction} className="mt-8">
          <input type="hidden" name="registrationId" value={registration.id} />
          <button className="text-sm text-[var(--mute)] underline" type="submit">
            Cancel my attendance
          </button>
        </form>
      ) : null}
    </div>
  );
}
