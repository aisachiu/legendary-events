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
    include: { payment: true },
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

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-serif text-4xl">Payment for {event.title}</h1>
      <p className="mt-2 text-[var(--mute)]">
        {formatMoney(event.priceCents, event.currency)}. Pay the host off-platform (transfer,
        cash, invoice), then upload a receipt. Your place is confirmed when they mark you
        paid.
      </p>
      <div className="mt-4">
        <StatusPills
          registrationStatus={registration.status}
          paymentStatus={registration.payment?.status}
        />
      </div>
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}

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
    </div>
  );
}
