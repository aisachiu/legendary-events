"use client";

import { useMemo, useState } from "react";
import {
  type BookerContact,
  type ContactAudience,
  buildMailtoBcc,
  emailsForCopy,
  partitionContacts,
  phonesForCopy,
  smsHref,
} from "@/lib/contacts";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    document.body.removeChild(field);
  }
}

const AUDIENCES: { id: ContactAudience; label: string }[] = [
  { id: "coming", label: "Coming" },
  { id: "reserved", label: "Reserved" },
  { id: "waitlist", label: "Waitlist" },
  { id: "all", label: "All active" },
];

export function ContactGuests({
  eventTitle,
  bookers,
}: {
  eventTitle: string;
  bookers: BookerContact[];
}) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<ContactAudience>("coming");
  const [flash, setFlash] = useState<string | null>(null);

  const buckets = useMemo(() => partitionContacts(bookers, audience), [bookers, audience]);
  const total =
    buckets.emailable.length + buckets.phoneOnly.length + buckets.unreachable.length;

  function flashMsg(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 1800);
  }

  async function onCopyEmails() {
    const text = emailsForCopy(buckets.emailable.map((c) => c.email!).filter(Boolean));
    if (!text) return;
    await copyText(text);
    flashMsg("Emails copied");
  }

  async function onCopyPhones() {
    const text = phonesForCopy(buckets.phoneOnly.map((c) => c.phone!).filter(Boolean));
    if (!text) return;
    await copyText(text);
    flashMsg("Phones copied");
  }

  async function onEmailAll() {
    const emails = buckets.emailable.map((c) => c.email!).filter(Boolean);
    const built = buildMailtoBcc(emails, eventTitle);
    if (!built) return;
    if (built.tooLong || !built.href) {
      await copyText(emailsForCopy(built.emails));
      flashMsg("List too long for mail app — emails copied");
      return;
    }
    window.location.href = built.href;
  }

  return (
    <div className="mt-4">
      <button className="btn-gold" type="button" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide contact list" : "Contact guests"}
      </button>

      {open ? (
        <div className="card mt-4 p-5">
          <p className="font-serif text-xl">Contact bookers</p>
          <p className="mt-1 text-sm text-[var(--mute)]">
            Opens your mail or messages app, or copies a list. Contact is per booking — extra party
            names do not have their own email or phone.
          </p>

          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Audience">
            {AUDIENCES.map((a) => (
              <button
                key={a.id}
                type="button"
                className={audience === a.id ? "btn-gold" : "btn-line"}
                onClick={() => setAudience(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>

          <p className="mt-3 text-sm text-[var(--mute)]">
            {total === 0
              ? "No bookers in this group."
              : `${buckets.emailable.length} email · ${buckets.phoneOnly.length} phone only${
                  buckets.unreachable.length
                    ? ` · ${buckets.unreachable.length} unreachable`
                    : ""
                }`}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn-gold"
              type="button"
              disabled={buckets.emailable.length === 0}
              onClick={() => void onEmailAll()}
            >
              Email all{buckets.emailable.length ? ` (${buckets.emailable.length})` : ""}
            </button>
            <button
              className="btn-line"
              type="button"
              disabled={buckets.emailable.length === 0}
              onClick={() => void onCopyEmails()}
            >
              Copy emails
            </button>
            <button
              className="btn-line"
              type="button"
              disabled={buckets.phoneOnly.length === 0}
              onClick={() => void onCopyPhones()}
            >
              Copy phones{buckets.phoneOnly.length ? ` (${buckets.phoneOnly.length})` : ""}
            </button>
            {flash ? <span className="self-center text-sm text-[var(--mute)]">{flash}</span> : null}
          </div>

          {buckets.phoneOnly.length > 0 ? (
            <p className="mt-2 text-xs text-[var(--mute)]">
              Phone-only guests: copy the list into Messages, or tap Text beside a name. Most phones
              cannot open a group text from the browser.
            </p>
          ) : null}

          {total > 0 ? (
            <ul className="mt-5 divide-y divide-[var(--line)] text-sm">
              {buckets.emailable.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="font-medium">{c.name}</span>
                  <a className="text-[var(--mute)] underline" href={`mailto:${c.email}`}>
                    {c.email}
                  </a>
                </li>
              ))}
              {buckets.phoneOnly.map((c) => {
                const href = c.phone ? smsHref(c.phone) : null;
                return (
                  <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <span className="font-medium">{c.name}</span>
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="text-[var(--mute)]">{c.phone}</span>
                      {href ? (
                        <a className="underline" href={href}>
                          Text
                        </a>
                      ) : null}
                    </span>
                  </li>
                );
              })}
              {buckets.unreachable.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-[var(--mute)]">No email or phone</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
