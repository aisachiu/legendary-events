import Link from "next/link";
import { redirect } from "next/navigation";
import { updateEventAction } from "@/app/actions/events";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { EventForm, type CopyableChannel } from "@/components/EventForm";
import { GuestManageList } from "@/components/GuestManageList";
import { GuestViewList, type PartyRow } from "@/components/GuestViewList";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen, toDatetimeLocal } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { OCCUPYING_STATUSES } from "@/lib/registrations";
import { canManageEvent } from "@/lib/roles";
import { publicEventUrl } from "@/lib/slugs";

function tabHref(
  id: string,
  tab: "guests" | "details",
  opts?: { mode?: "view" | "manage"; amounts?: boolean; channel?: string },
) {
  const params = new URLSearchParams();
  if (tab === "details") params.set("tab", "details");
  if (tab === "guests" && opts?.mode === "manage") params.set("mode", "manage");
  if (opts?.amounts) params.set("amounts", "1");
  if (opts?.channel && opts.channel !== "all") params.set("channel", opts.channel);
  const q = params.toString();
  return q ? `/dashboard/events/${id}?${q}` : `/dashboard/events/${id}`;
}

export default async function EventDeskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    tab?: string;
    mode?: string;
    amounts?: string;
    channel?: string;
  }>;
}) {
  const { id } = await params;
  const {
    error,
    tab: tabParam,
    mode: modeParam,
    amounts,
    channel: channelParam,
  } = await searchParams;
  const tab = tabParam === "details" ? "details" : "guests";
  const mode = modeParam === "manage" ? "manage" : "view";
  const showAmounts = amounts === "1";

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      channels: {
        orderBy: { createdAt: "asc" },
        include: {
          registrations: {
            include: {
              user: true,
              spots: { include: { payment: true }, orderBy: { createdAt: "asc" } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
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

  const creatingChannel = tab === "details" && channelParam === "new";
  const selectedChannel =
    creatingChannel
      ? null
      : event.channels.find((c) => c.id === channelParam) ?? event.channels[0] ?? null;
  const publicChannel = selectedChannel ?? event.channels[0] ?? null;

  const guestChannelFilter =
    tab === "guests" && channelParam && channelParam !== "all" && channelParam !== "new"
      ? channelParam
      : "all";

  const allRegistrations = event.channels.flatMap((c) =>
    c.registrations.map((r) => ({ ...r, channel: c })),
  );
  const filteredRegistrations =
    guestChannelFilter === "all"
      ? allRegistrations
      : allRegistrations.filter((r) => r.channelId === guestChannelFilter);

  const occupyingSpots = filteredRegistrations.flatMap((r) =>
    r.spots.filter((s) => (OCCUPYING_STATUSES as readonly string[]).includes(s.status)),
  );
  const coming = filteredRegistrations.filter((r) => r.spots.some((s) => s.status === "CONFIRMED"));
  const reserved = filteredRegistrations.filter(
    (r) =>
      r.status === "PENDING_PAYMENT" && r.spots.some((s) => s.status === "PENDING_PAYMENT"),
  );
  const waitlist = filteredRegistrations.filter((r) => r.status === "WAITLISTED");
  const cancelled = filteredRegistrations.filter((r) => r.status === "CANCELLED");
  const waitlistSpots = waitlist.reduce(
    (n, r) => n + r.spots.filter((s) => s.status === "WAITLISTED").length,
    0,
  );
  const cancelledSpots = cancelled.reduce((n, r) => n + r.spots.length, 0);

  const capacityLabel =
    guestChannelFilter !== "all" && selectedChannel
      ? selectedChannel.capacity != null
        ? `${occupyingSpots.length} / ${selectedChannel.capacity} participants (you can exceed quota)`
        : `${occupyingSpots.length} participants`
      : `${occupyingSpots.length} participants across ${event.channels.length} channel${event.channels.length === 1 ? "" : "s"}`;

  const parties: PartyRow[] = filteredRegistrations.map((r) => ({
    id: r.id,
    status: r.status,
    channelName: r.channel.name,
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

  const manageRows = (rows: typeof filteredRegistrations) =>
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      channelName: r.channel.name,
      maxPerOrder: r.channel.maxPerOrder,
      user: { name: r.user.name, email: r.user.email, phone: r.user.phone },
      spots: r.spots.map((s) => ({
        id: s.id,
        name: s.name,
        isHolder: s.isHolder,
        status: s.status,
        payment: s.payment
          ? {
              id: s.payment.id,
              status: s.payment.status,
              amountCents: s.payment.amountCents,
              currency: s.payment.currency,
              evidencePath: s.payment.evidencePath,
              evidenceNote: s.payment.evidenceNote,
              refundNote: s.payment.refundNote,
              refundAmountCents: s.payment.refundAmountCents,
            }
          : null,
      })),
    }));

  const copyableChannels: CopyableChannel[] = event.channels.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    venue: c.venue,
    startsAt: toDatetimeLocal(c.startsAt),
    endsAt: toDatetimeLocal(c.endsAt),
    isNetworking: c.isNetworking,
    isPaid: c.isPaid,
    price: (c.priceCents / 100).toFixed(2),
    currency: c.currency,
    capacity: c.capacity,
    maxPerOrder: c.maxPerOrder,
    paymentInstructions: c.paymentInstructions,
    themeId: c.themeId,
    contactDetails: c.contactDetails,
    goingVisibility: c.goingVisibility,
  }));

  const tabClass = (active: boolean) =>
    active
      ? "border-b-2 border-[var(--ink)] pb-2 font-medium"
      : "border-b-2 border-transparent pb-2 text-[var(--mute)] hover:text-[var(--ink)]";

  const modeClass = (active: boolean) => (active ? "btn-gold" : "btn-line");
  const channelOptions = event.channels.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div
      className={`mx-auto max-w-5xl px-5 py-12${tab === "guests" && mode === "view" ? " guest-list-page" : ""}`}
    >
      <Link href="/dashboard" className="guest-list-no-print text-sm text-[var(--mute)]">
        ← Host desk
      </Link>
      <div className="guest-list-no-print mt-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-4xl">{event.title}</h1>
        <div className="flex flex-wrap gap-2">
          {publicChannel ? (
            <>
              <Link href={`/events/${publicChannel.slug}`} className="btn-line">
                Public page
              </Link>
              <CopyLinkButton
                url={publicEventUrl(publicChannel.slug)}
                label="Copy public link"
              />
            </>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-sm text-[var(--mute)]">
        {publicChannel ? formatWhen(publicChannel.startsAt) : "No channel yet"} · {capacityLabel}
        {waitlistSpots ? ` · ${waitlistSpots} waitlisted` : ""}
        {cancelledSpots ? ` · ${cancelledSpots} cancelled` : ""}
      </p>
      {publicChannel ? (
        <p className="guest-list-no-print mt-1 truncate font-mono text-xs text-[var(--mute)]">
          {publicEventUrl(publicChannel.slug)}
        </p>
      ) : null}

      <nav className="guest-list-no-print mt-8 flex gap-6 border-b border-[var(--line)] text-sm">
        <Link
          href={tabHref(event.id, "guests", {
            mode,
            amounts: showAmounts,
            channel: guestChannelFilter,
          })}
          className={tabClass(tab === "guests")}
        >
          Guests
        </Link>
        <Link
          href={tabHref(event.id, "details", {
            channel: selectedChannel?.id ?? (creatingChannel ? "new" : undefined),
          })}
          className={tabClass(tab === "details")}
        >
          Event details
        </Link>
      </nav>

      {tab === "details" ? (
        <div className="card mt-8 p-6">
          <EventForm
            key={creatingChannel ? "new" : (selectedChannel?.id ?? "empty")}
            action={updateEventAction}
            submitLabel={creatingChannel ? "Create channel" : "Save"}
            showVisibility
            error={error}
            channels={channelOptions}
            values={{
              id: event.id,
              title: event.title,
              visibility: event.visibility,
              copyableChannels,
              channel: selectedChannel
                ? {
                    id: selectedChannel.id,
                    name: selectedChannel.name,
                    slug: selectedChannel.slug,
                    description: selectedChannel.description,
                    venue: selectedChannel.venue,
                    startsAt: toDatetimeLocal(selectedChannel.startsAt),
                    endsAt: toDatetimeLocal(selectedChannel.endsAt),
                    isNetworking: selectedChannel.isNetworking,
                    isPaid: selectedChannel.isPaid,
                    price: (selectedChannel.priceCents / 100).toFixed(2),
                    currency: selectedChannel.currency,
                    capacity: selectedChannel.capacity,
                    maxPerOrder: selectedChannel.maxPerOrder,
                    paymentInstructions: selectedChannel.paymentInstructions,
                    themeId: selectedChannel.themeId,
                    contactDetails: selectedChannel.contactDetails,
                    goingVisibility: selectedChannel.goingVisibility,
                  }
                : creatingChannel
                  ? { name: "" }
                  : undefined,
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
                href={tabHref(event.id, "guests", {
                  mode: "view",
                  amounts: showAmounts,
                  channel: guestChannelFilter,
                })}
                className={modeClass(mode === "view")}
              >
                View
              </Link>
              <Link
                href={tabHref(event.id, "guests", {
                  mode: "manage",
                  amounts: showAmounts,
                  channel: guestChannelFilter,
                })}
                className={modeClass(mode === "manage")}
              >
                Manage
              </Link>
            </div>
          </div>

          {mode === "view" ? (
            <GuestViewList
              eventTitle={event.title}
              parties={parties}
              showAmounts={showAmounts}
              channels={channelOptions}
              channelFilter={guestChannelFilter}
            />
          ) : (
            <div className="mt-8">
              {channelOptions.length > 1 ? (
                <div className="mb-6 flex flex-wrap gap-2 text-sm">
                  <Link
                    href={tabHref(event.id, "guests", {
                      mode: "manage",
                      amounts: showAmounts,
                      channel: "all",
                    })}
                    className={guestChannelFilter === "all" ? "font-medium underline" : "text-[var(--mute)]"}
                  >
                    All channels
                  </Link>
                  {channelOptions.map((c) => (
                    <Link
                      key={c.id}
                      href={tabHref(event.id, "guests", {
                        mode: "manage",
                        amounts: showAmounts,
                        channel: c.id,
                      })}
                      className={
                        guestChannelFilter === c.id
                          ? "font-medium underline"
                          : "text-[var(--mute)]"
                      }
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              ) : null}

              <h3 className="font-serif text-2xl">Coming</h3>
              <p className="mt-1 text-sm text-[var(--mute)]">Confirmed guests.</p>
              <GuestManageList
                rows={manageRows(coming)}
                variant="participants"
                maxPerOrder={selectedChannel?.maxPerOrder ?? 1}
              />

              <h3 className="mt-12 font-serif text-2xl">Reserved</h3>
              <p className="mt-1 text-sm text-[var(--mute)]">Awaiting payment confirmation.</p>
              <GuestManageList
                rows={manageRows(reserved)}
                variant="participants"
                maxPerOrder={selectedChannel?.maxPerOrder ?? 1}
              />

              <h3 className="mt-12 font-serif text-2xl">Waitlist</h3>
              <p className="mt-1 text-sm text-[var(--mute)]">Waiting for a spot.</p>
              <GuestManageList
                rows={manageRows(waitlist)}
                variant="waitlist"
                maxPerOrder={selectedChannel?.maxPerOrder ?? 1}
              />

              <h3 className="mt-12 font-serif text-2xl">Cancelled</h3>
              <p className="mt-1 text-sm text-[var(--mute)]">Removed or self-cancelled.</p>
              <GuestManageList
                rows={manageRows(cancelled)}
                variant="cancelled"
                maxPerOrder={selectedChannel?.maxPerOrder ?? 1}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
