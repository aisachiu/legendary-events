import { Suspense } from "react";
import { ContactGuests } from "@/components/ContactGuests";
import { AmountsToggle, ChannelFilter, PrintButton } from "@/components/GuestListControls";
import { displayContactLine } from "@/lib/contacts";
import { formatMoney } from "@/lib/format";

export type SpotRow = {
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

export type PartyRow = {
  id: string;
  status: string;
  channelName?: string;
  user: { name: string; email: string; phone: string | null };
  spots: SpotRow[];
};

function activeSpots(spots: SpotRow[]) {
  return spots.filter((s) => s.status !== "CANCELLED");
}

function partySection(parties: PartyRow[]) {
  return parties.filter((p) => activeSpots(p.spots).length > 0);
}

function PartyHeading({ party }: { party: PartyRow }) {
  return (
    <p className="font-medium">
      {party.user.name}{" "}
      {party.channelName ? (
        <span className="text-sm font-normal text-[var(--mute)]">· {party.channelName} </span>
      ) : null}
      <span className="text-sm font-normal text-[var(--mute)]">
        ({displayContactLine(party.user)})
      </span>
    </p>
  );
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
    <section className={title ? "guest-list-section mt-10" : undefined}>
      {title ? <h2 className="font-serif text-2xl">{title}</h2> : null}
      <div className={title ? "mt-4 space-y-6" : "mt-4 space-y-6"}>
        {parties.map((party) => {
          const spots = activeSpots(party.spots);
          return (
            <div key={party.id} className="guest-list-party">
              <PartyHeading party={party} />
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

function CancelledSection({
  parties,
  showAmounts,
}: {
  parties: PartyRow[];
  showAmounts: boolean;
}) {
  if (parties.length === 0) return null;
  const count = parties.reduce((n, p) => n + p.spots.length, 0);
  return (
    <details className="guest-list-section guest-list-no-print mt-10">
      <summary className="cursor-pointer font-serif text-2xl">
        Cancelled{" "}
        <span className="font-sans text-base font-normal text-[var(--mute)]">({count})</span>
      </summary>
      <div className="mt-4 space-y-6">
        {parties.map((party) => (
          <div key={party.id} className="guest-list-party">
            <PartyHeading party={party} />
            <table className="guest-list-table mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--mute)]">
                  <th className="py-1 pr-3 font-normal">Name</th>
                  <th className="py-1 pr-3 font-normal">Status</th>
                  {showAmounts ? <th className="py-1 font-normal">Amount</th> : null}
                </tr>
              </thead>
              <tbody>
                {party.spots.map((spot) => (
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
        ))}
      </div>
    </details>
  );
}

export function GuestViewList({
  eventTitle,
  parties,
  showAmounts,
  channels,
  channelFilter,
}: {
  eventTitle: string;
  parties: PartyRow[];
  showAmounts: boolean;
  channels?: { id: string; name: string }[];
  channelFilter?: string;
}) {
  const coming = partySection(parties.filter((p) => p.spots.some((s) => s.status === "CONFIRMED")));
  const reserved = partySection(
    parties.filter(
      (p) =>
        p.status === "PENDING_PAYMENT" &&
        p.spots.some((s) => s.status === "PENDING_PAYMENT"),
    ),
  );
  const waitlist = partySection(parties.filter((p) => p.status === "WAITLISTED"));
  const cancelled = parties.filter((p) => p.status === "CANCELLED" && p.spots.length > 0);

  return (
    <div className="guest-list-page">
      <div className="guest-list-no-print mt-4 flex flex-wrap items-center gap-4">
        <Suspense fallback={<span className="text-sm text-[var(--mute)]">Loading…</span>}>
          <AmountsToggle showAmounts={showAmounts} />
        </Suspense>
        {channels && channels.length > 1 ? (
          <Suspense fallback={null}>
            <ChannelFilter channels={channels} channelFilter={channelFilter ?? "all"} />
          </Suspense>
        ) : null}
        <PrintButton />
      </div>

      <div className="guest-list-no-print">
        <ContactGuests
          eventTitle={eventTitle}
          defaultOpen
          bookers={parties.map((p) => ({
            id: p.id,
            name: p.user.name,
            email: p.user.email,
            phone: p.user.phone,
            status: p.status,
          }))}
        />
      </div>

      <GuestListSection title="Coming" parties={coming} showAmounts={showAmounts} />
      <GuestListSection title="Reserved" parties={reserved} showAmounts={showAmounts} />
      <GuestListSection title="Waitlist" parties={waitlist} showAmounts={showAmounts} />
      <CancelledSection parties={cancelled} showAmounts={showAmounts} />

      {coming.length === 0 &&
      reserved.length === 0 &&
      waitlist.length === 0 &&
      cancelled.length === 0 ? (
        <p className="mt-10 text-[var(--mute)]">No guests yet.</p>
      ) : null}
    </div>
  );
}
