import Link from "next/link";
import { redirect } from "next/navigation";
import { updateEventAction } from "@/app/actions/events";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { EventForm } from "@/components/EventForm";
import { GuestManageList } from "@/components/GuestManageList";
import { GuestViewList, type PartyRow } from "@/components/GuestViewList";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen, toDatetimeLocal } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { OCCUPYING_STATUSES } from "@/lib/registrations";
import { canManageEvent } from "@/lib/roles";
import { publicEventUrl } from "@/lib/slugs";

function tabHref(id: string, tab: "guests" | "details", mode?: "view" | "manage", amounts?: boolean) {
  const params = new URLSearchParams();
  if (tab === "details") params.set("tab", "details");
  if (tab === "guests" && mode === "manage") params.set("mode", "manage");
  if (amounts) params.set("amounts", "1");
  const q = params.toString();
  return q ? `/dashboard/events/${id}?${q}` : `/dashboard/events/${id}`;
}

export default async function EventDeskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; tab?: string; mode?: string; amounts?: string }>;
}) {
  const { id } = await params;
  const { error, tab: tabParam, mode: modeParam, amounts } = await searchParams;
  const tab = tabParam === "details" ? "details" : "guests";
  const mode = modeParam === "manage" ? "manage" : "view";
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

  const occupyingSpots = event.registrations.flatMap((r) =>
    r.spots.filter((s) => (OCCUPYING_STATUSES as readonly string[]).includes(s.status)),
  );
  const coming = event.registrations.filter((r) => r.spots.some((s) => s.status === "CONFIRMED"));
  const reserved = event.registrations.filter(
    (r) =>
      r.status === "PENDING_PAYMENT" && r.spots.some((s) => s.status === "PENDING_PAYMENT"),
  );
  const waitlist = event.registrations.filter((r) => r.status === "WAITLISTED");
  const cancelled = event.registrations.filter((r) => r.status === "CANCELLED");
  const waitlistSpots = waitlist.reduce(
    (n, r) => n + r.spots.filter((s) => s.status === "WAITLISTED").length,
    0,
  );
  const cancelledSpots = cancelled.reduce((n, r) => n + r.spots.length, 0);
  const occupancyLabel =
    event.capacity != null
      ? `${occupyingSpots.length} / ${event.capacity} participants (you can exceed quota)`
      : `${occupyingSpots.length} participants`;

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

  const tabClass = (active: boolean) =>
    active
      ? "border-b-2 border-[var(--ink)] pb-2 font-medium"
      : "border-b-2 border-transparent pb-2 text-[var(--mute)] hover:text-[var(--ink)]";

  const modeClass = (active: boolean) => (active ? "btn-gold" : "btn-line");

  return (
    <div className={`mx-auto max-w-5xl px-5 py-12${tab === "guests" && mode === "view" ? " guest-list-page" : ""}`}>
      <Link href="/dashboard" className="guest-list-no-print text-sm text-[var(--mute)]">
        ← Host desk
      </Link>
      <div className="guest-list-no-print mt-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-4xl">{event.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`/events/${event.slug}`} className="btn-line">
            Public page
          </Link>
          <CopyLinkButton url={publicEventUrl(event.slug)} label="Copy public link" />
        </div>
      </div>
      <p className="mt-2 text-sm text-[var(--mute)]">
        {formatWhen(event.startsAt)} · {occupancyLabel}
        {waitlistSpots ? ` · ${waitlistSpots} waitlisted` : ""}
        {cancelledSpots ? ` · ${cancelledSpots} cancelled` : ""}
      </p>
      <p className="guest-list-no-print mt-1 truncate font-mono text-xs text-[var(--mute)]">
        {publicEventUrl(event.slug)}
      </p>

      <nav className="guest-list-no-print mt-8 flex gap-6 border-b border-[var(--line)] text-sm">
        <Link href={tabHref(event.id, "guests", mode, showAmounts)} className={tabClass(tab === "guests")}>
          Guests
        </Link>
        <Link href={tabHref(event.id, "details")} className={tabClass(tab === "details")}>
          Event details
        </Link>
      </nav>

      {tab === "details" ? (
        <div className="card mt-8 p-6">
          <EventForm
            action={updateEventAction}
            submitLabel="Save event"
            showPublished
            error={error}
            values={{
              id: event.id,
              slug: event.slug,
              title: event.title,
              description: event.description,
              venue: event.venue,
              startsAt: toDatetimeLocal(event.startsAt),
              endsAt: toDatetimeLocal(event.endsAt),
              isNetworking: event.isNetworking,
              isPaid: event.isPaid,
              published: event.published,
              price: (event.priceCents / 100).toFixed(2),
              currency: event.currency,
              capacity: event.capacity,
              maxPerOrder: event.maxPerOrder,
              paymentInstructions: event.paymentInstructions,
              themeId: event.themeId,
              contactDetails: event.contactDetails,
            }}
          />
        </div>
      ) : (
        <>
          <div className="guest-list-no-print mt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">Guest management</h2>
              <p className="mt-1 text-sm text-[var(--mute)]">
                {mode === "view"
                  ? "Simple guest list with contact and print."
                  : "Payments, party edits, waitlist, and cancellations."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={tabHref(event.id, "guests", "view", showAmounts)}
                className={modeClass(mode === "view")}
              >
                View
              </Link>
              <Link
                href={tabHref(event.id, "guests", "manage", showAmounts)}
                className={modeClass(mode === "manage")}
              >
                Manage
              </Link>
            </div>
          </div>

          {mode === "view" ? (
            <GuestViewList eventTitle={event.title} parties={parties} showAmounts={showAmounts} />
          ) : (
            <div className="mt-8">
              <h3 className="font-serif text-2xl">Coming</h3>
              <p className="mt-1 text-sm text-[var(--mute)]">Confirmed guests.</p>
              <GuestManageList rows={coming} variant="participants" maxPerOrder={event.maxPerOrder} />

              <h3 className="mt-12 font-serif text-2xl">Reserved</h3>
              <p className="mt-1 text-sm text-[var(--mute)]">Awaiting payment confirmation.</p>
              <GuestManageList rows={reserved} variant="participants" maxPerOrder={event.maxPerOrder} />

              <h3 className="mt-12 font-serif text-2xl">Waitlist</h3>
              <p className="mt-1 text-sm text-[var(--mute)]">
                Oldest first. Moving a group in does not have to respect the quota.
              </p>
              <GuestManageList rows={waitlist} variant="waitlist" maxPerOrder={event.maxPerOrder} />

              <h3 className="mt-12 font-serif text-2xl">Cancelled</h3>
              <p className="mt-1 text-sm text-[var(--mute)]">
                Payment records stay here so you can mark receipts and refunds.
              </p>
              <GuestManageList rows={cancelled} variant="cancelled" maxPerOrder={event.maxPerOrder} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
