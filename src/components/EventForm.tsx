"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DescriptionEditor } from "@/components/DescriptionEditor";
import { CURRENCY_PRESETS, currencyPresetValue } from "@/lib/currency";
import { previewEventPath, publicEventUrl } from "@/lib/slugs";
import { themeList } from "@/lib/themes";

export type EventFormValues = {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  venue?: string;
  startsAt?: string;
  endsAt?: string;
  isNetworking?: boolean;
  isPaid?: boolean;
  published?: boolean;
  price?: string;
  currency?: string;
  capacity?: number | null;
  maxPerOrder?: number;
  paymentInstructions?: string | null;
  themeId?: string | null;
  contactDetails?: string | null;
};

function formErrorMessage(error?: string) {
  if (error === "price") return "Paid events need a price of at least 1.00.";
  if (error === "slug") return "That link is already used, or is not valid. Use letters, numbers, and hyphens.";
  if (error) return "Fill title, description, venue, and start time.";
  return null;
}

export function EventForm({
  action,
  values,
  submitLabel,
  showPublished,
  extraHidden,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: EventFormValues;
  submitLabel: string;
  showPublished?: boolean;
  extraHidden?: Record<string, string>;
  error?: string;
}) {
  const [isPaid, setIsPaid] = useState(Boolean(values?.isPaid));
  const [limitCapacity, setLimitCapacity] = useState(Boolean(values?.capacity));
  const [title, setTitle] = useState(values?.title ?? "");
  const [slug, setSlug] = useState(values?.slug ?? "");
  const initialPreset = currencyPresetValue(values?.currency ?? "hkd");
  const [currencyPreset, setCurrencyPreset] = useState(initialPreset);
  const otherDefault = useMemo(() => {
    const code = (values?.currency ?? "").toUpperCase();
    return initialPreset === "OTHER" ? code : "";
  }, [values?.currency, initialPreset]);
  const previewSlug = previewEventPath(title, slug);
  const savedUrl = values?.slug ? publicEventUrl(values.slug) : null;
  const errorMessage = formErrorMessage(error);

  return (
    <form action={action} className="grid gap-4">
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {extraHidden
        ? Object.entries(extraHidden).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))
        : null}
      {errorMessage ? <p className="text-sm text-red-800">{errorMessage}</p> : null}

      <div>
        <label className="label">Title</label>
        <input
          className="field"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Link slug</label>
        <input
          className="field font-mono text-sm"
          name="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="auto from title"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-[var(--mute)]">
          Public page: /events/{previewSlug}
          {slug ? "" : " — leave blank to generate from the title."}
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
            defaultValue={values?.startsAt}
          />
        </div>
        <div>
          <label className="label">End (optional)</label>
          <input
            className="field"
            type="datetime-local"
            name="endsAt"
            defaultValue={values?.endsAt}
          />
        </div>
      </div>

      <div>
        <label className="label">Venue</label>
        <input className="field" name="venue" required defaultValue={values?.venue} />
      </div>

      <div>
        <label className="label">Description</label>
        <DescriptionEditor name="description" defaultValue={values?.description} />
      </div>

      <div>
        <label className="label">Participant contact details</label>
        <textarea
          className="field min-h-24"
          name="contactDetails"
          defaultValue={values?.contactDetails ?? ""}
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
          defaultChecked={values?.isNetworking ?? true}
        />
        Who&apos;s Going Page: confirmed guests can see each other
      </label>

      <div>
        <label className="label">Theme</label>
        <select className="field max-w-md" name="themeId" defaultValue={values?.themeId ?? "inherit"}>
          <option value="inherit">Site default</option>
          {themeList.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--mute)]">
          Overrides the site-wide theme on this event&apos;s public pages.
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
              defaultValue={values?.capacity ?? 20}
            />
            <p className="mt-1 text-xs text-[var(--mute)]">
              Extra signups go on a waiting list. You can still move people in over quota.
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
          defaultValue={values?.maxPerOrder ?? 1}
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
        Paid event (guests upload a receipt; you mark them paid)
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
                defaultValue={values?.price ?? "45"}
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
                  defaultValue={otherDefault}
                  maxLength={3}
                />
              ) : null}
            </div>
          </div>
          <div>
            <label className="label">Payment instructions</label>
            <DescriptionEditor
              name="paymentInstructions"
              defaultValue={values?.paymentInstructions ?? ""}
              placeholder="Bank details, FPS, Venmo, QR code, what to write in the transfer memo…"
            />
            <p className="mt-1 text-xs text-[var(--mute)]">
              Guests see this on the payment page. Use Image to add a QR code or screenshot.
            </p>
          </div>
        </>
      ) : null}

      {showPublished ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={values?.published ?? true} />
          Published
        </label>
      ) : null}

      <button className="btn-gold w-fit" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
