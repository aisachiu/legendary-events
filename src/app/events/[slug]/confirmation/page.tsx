import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusPills } from "@/components/Pills";

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event || !user) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>Sign in to see your confirmation.</p>
      </div>
    );
  }

  const registration = await prisma.registration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
    include: { payment: true },
  });
  if (!registration) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>No signup on file.</p>
      </div>
    );
  }

  const confirmed = registration.status === "CONFIRMED";
  const waiting =
    registration.payment?.status === "AWAITING_REVIEW" && !confirmed;

  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <h1 className="font-serif text-4xl">
        {confirmed ? "You are confirmed" : waiting ? "Evidence is with the host" : "Almost in"}
      </h1>
      <p className="mt-3 text-[var(--mute)]">{event.title}</p>
      <div className="mt-4">
        <StatusPills
          registrationStatus={registration.status}
          paymentStatus={registration.payment?.status}
        />
      </div>
      {waiting ? (
        <p className="mt-6 text-sm leading-6 text-[var(--mute)]">
          The host will open this once they match your upload. You will not see other
          bios until then.
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/events/${slug}`} className="btn-line">
          Event page
        </Link>
        {confirmed && event.isNetworking ? (
          <Link href={`/events/${slug}/room`} className="btn-gold">
            See who is coming
          </Link>
        ) : null}
        {!confirmed && event.isPaid ? (
          <Link href={`/events/${slug}/pay`} className="btn-gold">
            Upload receipt
          </Link>
        ) : null}
      </div>
    </div>
  );
}
