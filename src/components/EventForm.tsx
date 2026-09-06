"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DescriptionEditor } from "@/components/DescriptionEditor";
import { CURRENCY_PRESETS, currencyPresetValue } from "@/lib/currency";
import { previewEventPath, publicEventUrl } from "@/lib/slugs";
import { themeList } from "@/lib/themes";

export type ChannelFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  venue?: string;
  startsAt?: string;
  endsAt?: string;
  isNetworking?: boolean;
  isPaid?: boolean;
  price?: string;
  currency?: string;
  capacity?: number | null;
  maxPerOrder?: number;
  paymentInstructions?: string | null;
  themeId?: string | null;
  contactDetails?: string | null;
  goingVisibility?: string;
};

export type CopyableChannel = {
  id: string;
  name: string;
  description?: string;
  venue?: string;
  startsAt?: string;
  endsAt?: string;
  isNetworking?: boolean;
  isPaid?: boolean;
  price?: string;
  currency?: string;
  capacity?: number | null;
  maxPerOrder?: number;
  paymentInstructions?: string | null;
  themeId?: string | null;
  contactDetails?: string | null;
  goingVisibility?: string;
};

export type EventFormValues = {
  id?: string;
  title?: string;
  visibility?: string;
  channel?: ChannelFormValues;
  copyableChannels?: CopyableChannel[];
};

function formErrorMessage(error?: string) {
  if (error === "price") return "Paid events need a price of at least 1.00.";
  if (error === "slug") {
    return "That link is already used, or is not valid. Use letters, numbers, and hyphens.";
  }
  if (error) return "Fill title, channel name, description, venue, and start time.";
  return null;
}

export function EventForm({
  action,
  values,
  channels,
  submitLabel,
  showVisibility,
  extraHidden,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: EventFormValues;
  channels?: { id: string; name: string }[];
  submitLabel: string;
  showVisibility?: boolean;
  extraHidden?: Record<string, string>;
  error?: string;
}) {
  const isEdit = Boolean(values?.id);
  const channelList = channels ?? [];
  const channel = values?.channel;
  const creatingNew = isEdit && !channel?.id;
  const copyableChannels = values?.copyableChannels ?? [];

  const [channelName, setChannelName] = useState(channel?.name ?? "");
  const [isPaid, setIsPaid] = useState(Boolean(channel?.isPaid));
  const [limitCapacity, setLimitCapacity] = useState(Boolean(channel?.capacity));
  const [title, setTitle] = useState(values?.title ?? "");
  const [slug, setSlug] = useState(channel?.slug ?? "");
  const [venue, setVenue] = useState(channel?.venue ?? "");
  const [startsAt, setStartsAt] = useState(channel?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(channel?.endsAt ?? "");
  const [isNetworking, setIsNetworking] = useState(channel?.isNetworking ?? true);
  const [price, setPrice] = useState(channel?.price ?? "45");
  const [capacity, setCapacity] = useState(channel?.capacity ?? 20);
  const [maxPerOrder, setMaxPerOrder] = useState(channel?.maxPerOrder ?? 1);
  const [themeId, setThemeId] = useState(channel?.themeId ?? "inherit");
  const [contactDetails, setContactDetails] = useState(channel?.contactDetails ?? "");
  const [goingVisibility, setGoingVisibility] = useState(channel?.goingVisibility ?? "CHANNEL");
  const [visibility, setVisibility] = useState(values?.visibility ?? "PUBLIC");
  const [description, setDescription] = useState(channel?.description ?? "");
  const [paymentInstructions, setPaymentInstructions] = useState(
    channel?.paymentInstructions ?? "",
  );
  const [editorKey, setEditorKey] = useState(0);
  const [copyFromId, setCopyFromId] = useState("");

  const initialPreset = currencyPresetValue(channel?.currency ?? "hkd");
  const [currencyPreset, setCurrencyPreset] = useState(initialPreset);
  const otherDefault = useMemo(() => {
    const code = (channel?.currency ?? "").toUpperCase();
    return initialPreset === "OTHER" ? code : "";
  }, [channel?.currency, initialPreset]);
  const [currencyOther, setCurrencyOther] = useState(otherDefault);

  const previewSlug = previewEventPath(channelName || title, slug);
  const savedUrl = channel?.slug ? publicEventUrl(channel.slug) : null;
  const errorMessage = formErrorMessage(error);
  const otherCopySources = copyableChannels.filter((c) => c.id !== channel?.id);
  const selectedChannelId = creatingNew ? "new" : (channel?.id ?? channelList[0]?.id ?? "new");

  function applyCopy(sourceId: string) {
    const source = copyableChannels.find((c) => c.id === sourceId);
    if (!source) return;
    setVenue(source.venue ?? "");
    setStartsAt(source.startsAt ?? "");
    setEndsAt(source.endsAt ?? "");
    setIsNetworking(source.isNetworking ?? true);
    setIsPaid(Boolean(source.isPaid));
    setPrice(source.price ?? "45");
    setLimitCapacity(Boolean(source.capacity));
    setCapacity(source.capacity ?? 20);
    setMaxPerOrder(source.maxPerOrder ?? 1);
    setThemeId(source.themeId ?? "inherit");
    setContactDetails(source.contactDetails ?? "");
    setGoingVisibility(source.goingVisibility ?? "CHANNEL");
    setDescription(source.description ?? "");
    setPaymentInstructions(source.paymentInstructions ?? "");
    const preset = currencyPresetValue(source.currency ?? "hkd");
    setCurrencyPreset(preset);
    setCurrencyOther(preset === "OTHER" ? (source.currency ?? "").toUpperCase() : "");
    setEditorKey((k) => k + 1);
    setCopyFromId(sourceId);
  }

  return (
    <form action={action} className="grid gap-4">
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <input type="hidden" name="channelId" value={creatingNew ? "new" : (channel?.id ?? "new")} />
      {extraHidden
        ? Object.entries(extraHidden).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))
        : null}
      {errorMessage ? <p className="text-sm text-red-800">{errorMessage}</p> : null}

      {/* Embed copyable channel JSON for client-side copy-from */}
      {otherCopySources.length > 0 ? (
        <script
          type="application/json"
          id="copyable-channels-data"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(otherCopySources) }}
        />
      ) : null}

      <div>
        <label className="label">Event title</label>
        <input
          className="field"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {showVisibility ? (
        <div>
          <label className="label">Listing visibility</label>
          <select
            className="field max-w-md"
            name="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="PUBLIC">Public — listed on home</option>
            <option value="UNLISTED">Unlisted — link only</option>
          </select>
        </div>
      ) : (
        <input type="hidden" name="visibility" value={visibility} />
      )}

      {isEdit ? (
        <div>
          <label className="label">Channel</label>
          <select
            className="field max-w-md"
            value={selectedChannelId}
            onChange={(e) => {
              const next = e.target.value;
              const url = new URL(window.location.href);
              url.searchParams.set("tab", "details");
              if (next === "new") url.searchParams.set("channel", "new");
              else url.searchParams.set("channel", next);
              window.location.href = url.toString();
            }}
          >
            {channelList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="new">Create new channel…</option>
          </select>
        </div>
      ) : null}

      <div>
        <label className="label">Channel name</label>
        <input
          className="field"
          name="channelName"
          required
          value={channelName}
          onChange={(e) => setChannelName(e.target.value)}
          placeholder="e.g. Main, VIP, Morning session"
        />
      </div>

      {isEdit && otherCopySources.length > 0 ? (
        <div>
          <label className="label">Copy fields from another channel</label>
          <select
            className="field max-w-md"
            value={copyFromId}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                setCopyFromId("");
                return;
              }
              applyCopy(id);
            }}
          >
            <option value="">Don’t copy</option>
            {otherCopySources.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--mute)]">
            Fills description, venue, times, pricing, and other channel fields. Does not change the
            channel name or link slug.
          </p>
        </div>
      ) : null}

      <div>
        <label className="label">Link slug</label>
        <input
          className="field font-mono text-sm"
          name="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="auto from channel name"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-[var(--mute)]">
          Public page: /events/{previewSlug}
          {slug ? "" : " — leave blank to generate from the channel name."}
        </p>
        {savedUrl ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate text-xs text-[var(--ink)]">{savedUrl}</code>
            <CopyLinkButton url={savedUrl} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Start</label>
          <input
            className="field"
            type="datetime-local"
            name="startsAt"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div>
          <label className="label">End (optional)</label>
          <input
            className="field"
            type="datetime-local"
            name="endsAt"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Venue</label>
        <input
          className="field"
          name="venue"
          required
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Description</label>
        <DescriptionEditor
          key={`desc-${editorKey}`}
          name="description"
          defaultValue={description}
        />
      </div>

      <div>
        <label className="label">Participant contact details</label>
        <textarea
          className="field min-h-24"
          name="contactDetails"
          value={contactDetails}
          onChange={(e) => setContactDetails(e.target.value)}
          placeholder="Phone, email, or other support details"
        />
        <p className="mt-1 text-xs text-[var(--mute)]">
          Leave a phone number and/or email address or support details here for signed-up
          participants to contact. Only those who have registered can see it.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isNetworking"
          checked={isNetworking}
          onChange={(e) => setIsNetworking(e.target.checked)}
        />
        Who&apos;s Going Page: confirmed guests can see each other
      </label>

      {isNetworking ? (
        <div>
          <label className="label">Who&apos;s Going visibility</label>
          <select
            className="field max-w-md"
            name="goingVisibility"
            value={goingVisibility}
            onChange={(e) => setGoingVisibility(e.target.value)}
          >
            <option value="CHANNEL">This channel only</option>
            <option value="EVENT">All channels of this event</option>
          </select>
          <p className="mt-1 text-xs text-[var(--mute)]">
            EVENT shows confirmed guests across channels, without exposing other channel names or
            links.
          </p>
        </div>
      ) : (
        <input type="hidden" name="goingVisibility" value={goingVisibility} />
      )}

      <div>
        <label className="label">Theme</label>
        <select
          className="field max-w-md"
          name="themeId"
          value={themeId ?? "inherit"}
          onChange={(e) => setThemeId(e.target.value)}
        >
          <option value="inherit">Site default</option>
          {themeList.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--mute)]">
          Overrides the site-wide theme on this channel&apos;s public pages.
        </p>
      </div>

      <div className="grid gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="limitCapacity"
            checked={limitCapacity}
            onChange={(e) => setLimitCapacity(e.target.checked)}
          />
          Limit participants (quota)
        </label>
        {limitCapacity ? (
          <div>
            <label className="label">Participant quota</label>
            <input
              className="field max-w-40"
              type="number"
              name="capacity"
              min={1}
              step={1}
              required
              value={capacity ?? 20}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-[var(--mute)]">
              Extra signups go on a waiting list. You can still move people in over quota. Capacity is
              per channel.
            </p>
          </div>
        ) : null}
      </div>

      <div>
        <label className="label">Max spots each person can reserve</label>
        <input
          className="field max-w-40"
          type="number"
          name="maxPerOrder"
          min={1}
          step={1}
          value={maxPerOrder}
          onChange={(e) => setMaxPerOrder(Number(e.target.value))}
        />
        <p className="mt-1 text-xs text-[var(--mute)]">
          Includes themselves. Extra names are added at signup.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isPaid"
          checked={isPaid}
          onChange={(e) => setIsPaid(e.target.checked)}
        />
        Paid channel (guests upload a receipt; you mark them paid)
      </label>

      {isPaid ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Price</label>
              <input
                className="field"
                type="number"
                name="price"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <select
                className="field"
                name="currencyPreset"
                value={currencyPreset}
                onChange={(e) => setCurrencyPreset(e.target.value)}
              >
                {CURRENCY_PRESETS.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
                <option value="OTHER">Other</option>
              </select>
              {currencyPreset === "OTHER" ? (
                <input
                  className="field mt-2"
                  name="currencyOther"
                  placeholder="ISO code, e.g. SGD"
                  value={currencyOther}
                  onChange={(e) => setCurrencyOther(e.target.value)}
                  maxLength={3}
                />
              ) : null}
            </div>
          </div>
          <div>
            <label className="label">Payment instructions</label>
            <DescriptionEditor
              key={`pay-${editorKey}`}
              name="paymentInstructions"
              defaultValue={paymentInstructions}
              placeholder="Bank details, FPS, Venmo, QR code, what to write in the transfer memo…"
            />
            <p className="mt-1 text-xs text-[var(--mute)]">
              Guests see this on the payment page. Use Image to add a QR code or screenshot.
            </p>
          </div>
        </>
      ) : null}

      <button className="btn-gold w-fit" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
