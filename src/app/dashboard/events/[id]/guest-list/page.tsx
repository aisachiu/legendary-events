import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ContactGuests } from "@/components/ContactGuests";
import { AmountsToggle, PrintButton } from "@/components/GuestListControls";
import { getCurrentUser } from "@/lib/auth";
import { displayContactLine } from "@/lib/contacts";
import { formatMoney, formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canManageEvent } from "@/lib/roles";

type SpotRow = {
  id: string;
  name: string;
  isHolder: boolean;
  status: string;
  payment: {
    amountCents: number;
    currency: string;
    status: string;
  } | null;
};

type PartyRow = {
  id: string;
  status: string;
  user: { name: string; email: string; phone: string | null };
  spots: SpotRow[];
};

function activeSpots(spots: SpotRow[]) {
  return spots.filter((s) => s.status !== "CANCELLED");
}

function partySection(parties: PartyRow[]) {
  return parties.filter((p) => activeSpots(p.spots).length > 0);
}

function GuestListSection({
  title,
  parties,
  showAmounts,
}: {
  title: string;
  parties: PartyRow[];
  showAmounts: boolean;
}) {
  if (parties.length === 0) return null;

  return (
    <section className="guest-list-section mt-10">
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mt-4 space-y-6">
        {parties.map((party) => {
          const spots = activeSpots(party.spots);
          return (
            <div key={party.id} className="guest-list-party">
              <p className="font-medium">
                {party.user.name}{" "}
                <span className="text-sm font-normal text-[var(--mute)]">
                  ({displayContactLine(party.user)})
                </span>
              </p>
              <table className="guest-list-table mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--mute)]">
                    <th className="py-1 pr-3 font-normal">Name</th>
                    <th className="py-1 pr-3 font-normal">Status</th>
                    {showAmounts ? <th className="py-1 font-normal">Amount</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {spots.map((spot) => (
                    <tr key={spot.id} className="border-t border-[var(--line)]">
                      <td className="py-1.5 pr-3">
                        {spot.name}
                        {spot.isHolder ? " · booker" : ""}
                      </td>
                      <td className="py-1.5 pr-3">{spot.status}</td>
                      {showAmounts ? (
                        <td className="py-1.5">
                          {spot.payment
                            ? `${formatMoney(spot.payment.amountCents, spot.payment.currency)} (${spot.payment.status})`
                            : "—"}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default async function GuestListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ amounts?: string }>;
}) {
  const { id } = await params;
  const { amounts } = await searchParams;
  const showAmounts = amounts === "1";

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      registrations: {
        include: {
          user: true,
          spots: { include: { payment: true }, orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!event || !canManageEvent(user, event.organizerId)) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p>You do not host this event.</p>
      </div>
    );
  }

  const parties: PartyRow[] = event.registrations.map((r) => ({
    id: r.id,
    status: r.status,
    user: { name: r.user.name, email: r.user.email, phone: r.user.phone },
    spots: r.spots.map((s) => ({
      id: s.id,
      name: s.name,
      isHolder: s.isHolder,
      status: s.status,
      payment: s.payment
        ? {
            amountCents: s.payment.amountCents,
            currency: s.payment.currency,
            status: s.payment.status,
          }
        : null,
    })),
  }));

  const confirmed = partySection(
    parties.filter((p) => p.spots.some((s) => s.status === "CONFIRMED")),
  );
  const reserved = partySection(
    parties.filter(
      (p) =>
        p.status === "PENDING_PAYMENT" &&
        p.spots.some((s) => s.status === "PENDING_PAYMENT"),
    ),
  );
  const waitlist = partySection(parties.filter((p) => p.status === "WAITLISTED"));

  return (
    <div className="guest-list-page mx-auto max-w-4xl px-5 py-12">
      <div className="guest-list-no-print">
        <Link href={`/dashboard/events/${event.id}`} className="text-sm text-[var(--mute)]">
          ← Host desk
        </Link>
      </div>
      <h1 className="mt-4 font-serif text-4xl">Guest list</h1>
      <p className="mt-2 text-sm text-[var(--mute)]">
        {event.title} · {formatWhen(event.startsAt)} · {event.venue}
      </p>
      <div className="guest-list-no-print mt-6 flex flex-wrap items-center gap-4">
        <Suspense fallback={<span className="text-sm text-[var(--mute)]">Loading…</span>}>
          <AmountsToggle showAmounts={showAmounts} />
        </Suspense>
        <PrintButton />
      </div>
      <div className="guest-list-no-print">
        <ContactGuests
          eventTitle={event.title}
          bookers={event.registrations.map((r) => ({
            id: r.id,
            name: r.user.name,
            email: r.user.email,
            phone: r.user.phone,
            status: r.status,
          }))}
        />
      </div>

      <GuestListSection title="Confirmed / paid" parties={confirmed} showAmounts={showAmounts} />
      <GuestListSection
        title="Reserved, not yet paid"
        parties={reserved}
        showAmounts={showAmounts}
      />
      <GuestListSection title="Waiting list" parties={waitlist} showAmounts={showAmounts} />

      {confirmed.length === 0 && reserved.length === 0 && waitlist.length === 0 ? (
        <p className="mt-10 text-[var(--mute)]">No guests yet.</p>
      ) : null}
    </div>
  );
}
