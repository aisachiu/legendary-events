import Link from "next/link";
import { submitOfflinePaymentAction } from "@/app/actions/payments";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { StatusPills } from "@/components/Pills";

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>Sign in to pay.</p>
        <Link className="btn-gold mt-4" href={`/login?next=/events/${slug}/pay`}>
          Sign in
        </Link>
      </div>
    );
  }

  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) return null;

  const registration = await prisma.registration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
    include: { spots: { include: { payment: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!registration) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>Sign up first.</p>
        <Link className="btn-gold mt-4" href={`/events/${slug}`}>
          Back to event
        </Link>
      </div>
    );
  }

  if (registration.status === "WAITLISTED") {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>You are on the waitlist. Payment opens after the host moves you in.</p>
        <Link className="btn-gold mt-4" href={`/events/${slug}`}>
          Back to event
        </Link>
      </div>
    );
  }

  const dueSpots = registration.spots.filter(
    (s) => s.payment && s.payment.status !== "PAID" && s.payment.status !== "REFUNDED",
  );
  const dueCents = dueSpots.reduce((sum, s) => sum + (s.payment?.amountCents ?? 0), 0);
  const rejected = dueSpots.some((s) => s.payment?.status === "REJECTED");
  const paymentStatus = dueSpots[0]?.payment?.status;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-serif text-4xl">Complete Payment to Confirm Your Spot</h1>
      <p className="mt-2 text-[var(--mute)]">
        {formatMoney(event.priceCents, event.currency)} per person. You are the account holder.
        Total due: <strong>{formatMoney(dueCents, event.currency)}</strong> for {dueSpots.length}{" "}
        {dueSpots.length === 1 ? "spot" : "spots"}. You can upload payment evidence here or
        directly inform the host.
      </p>
      <ul className="mt-4 space-y-1 text-sm">
        {registration.spots
          .filter((s) => s.status !== "CANCELLED")
          .map((spot) => (
            <li key={spot.id}>
              {spot.name}
              {spot.payment
                ? ` · ${formatMoney(spot.payment.amountCents, spot.payment.currency)} · ${spot.payment.status}`
                : ""}
            </li>
          ))}
      </ul>
      <div className="mt-4">
        <StatusPills
          registrationStatus={registration.status}
          paymentStatus={paymentStatus}
        />
      </div>
      {rejected ? (
        <p className="mt-4 text-sm text-amber-900">
          The last receipt was rejected. Upload a new one.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}

      {event.paymentInstructions || event.paymentImagePath ? (
        <div className="card mt-8 p-6">
          <h2 className="font-serif text-2xl">How to pay</h2>
          {event.paymentInstructions ? (
            <p className="mt-3 whitespace-pre-wrap text-[var(--mute)]">
              {event.paymentInstructions}
            </p>
          ) : null}
          {event.paymentImagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/events/${slug}/pay-image`}
              alt="Payment details"
              className="mt-4 max-h-72 w-auto rounded-lg border border-[var(--line)]"
            />
          ) : null}
        </div>
      ) : null}

      {dueCents > 0 ? (
        <div className="card mt-8 p-6">
          <h2 className="font-serif text-2xl">Upload receipt</h2>
          <form action={submitOfflinePaymentAction} className="mt-4 space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <div>
              <label className="label">Evidence</label>
              <input className="field" type="file" name="evidence" required accept="image/*,.pdf" />
            </div>
            <div>
              <label className="label">Note for the host</label>
              <textarea
                className="field min-h-20"
                name="evidenceNote"
                placeholder="Transfer reference, last four, who paid…"
              />
            </div>
            <button className="btn-gold" type="submit">
              Submit evidence
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-8 text-sm text-[var(--mute)]">Nothing left to pay on this booking.</p>
      )}
    </div>
  );
}
