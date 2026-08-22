"use client";

import { useState } from "react";

export function PartyFields({
  maxPerOrder,
  defaultHolder,
  defaultGuests = [],
  requireHolderName,
}: {
  maxPerOrder: number;
  defaultHolder?: string;
  defaultGuests?: string[];
  requireHolderName?: boolean;
}) {
  const extraSlots = Math.max(0, maxPerOrder - 1);
  const [extras, setExtras] = useState<string[]>(
    defaultGuests.length ? defaultGuests : extraSlots > 0 ? [] : [],
  );

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Your name at the event</label>
        <input
          className="field"
          name="preferredName"
          required={requireHolderName}
          defaultValue={defaultHolder ?? ""}
        />
      </div>
      {extras.map((name, i) => (
        <div key={i} className="flex gap-2">
          <div className="flex-1">
            <label className="label">Additional person</label>
            <input
              className="field"
              name="guestName"
              required
              defaultValue={name}
            />
          </div>
          <button
            type="button"
            className="btn-line mt-6"
            onClick={() => setExtras((list) => list.filter((_, idx) => idx !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      {extras.length < extraSlots ? (
        <button
          type="button"
          className="btn-line"
          onClick={() => setExtras((list) => [...list, ""])}
        >
          Add another person
        </button>
      ) : null}
    </div>
  );
}

export function QuotaNotice({
  remaining,
  wanted,
  waitlistName = "waitlistGroup",
}: {
  remaining: number;
  wanted: number;
  waitlistName?: string;
}) {
  return (
    <div className="rounded-xl border border-amber-700/30 bg-amber-50 p-3 text-sm text-amber-950">
      <p>
        Only {remaining} {remaining === 1 ? "spot is" : "spots are"} left, but this group needs{" "}
        {wanted}. Reduce the number of names, or put the whole group on the waiting list.
      </p>
      <label className="mt-3 flex items-center gap-2">
        <input type="checkbox" name={waitlistName} />
        Join waitlist as a group
      </label>
    </div>
  );
}
