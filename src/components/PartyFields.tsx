"use client";

import { useEffect, useState } from "react";

export function PartyFields({
  maxPerOrder,
  defaultHolder,
  defaultGuests = [],
  defaultShowOnGoing,
  requireHolderName,
  showGoingOptIn,
}: {
  maxPerOrder: number;
  defaultHolder?: string;
  defaultGuests?: string[];
  defaultShowOnGoing?: boolean[];
  requireHolderName?: boolean;
  showGoingOptIn?: boolean;
}) {
  const extraSlots = Math.max(0, maxPerOrder - 1);
  const [extras, setExtras] = useState<string[]>(
    defaultGuests.length ? defaultGuests : extraSlots > 0 ? [] : [],
  );
  const [goingVisible, setGoingVisible] = useState<boolean[]>(() => {
    const size = 1 + (defaultGuests.length ? defaultGuests.length : 0);
    if (defaultShowOnGoing?.length) {
      return Array.from({ length: size }, (_, i) => defaultShowOnGoing[i] ?? true);
    }
    return Array.from({ length: size }, () => true);
  });

  useEffect(() => {
    const size = 1 + extras.length;
    setGoingVisible((prev) => {
      if (prev.length === size) return prev;
      if (prev.length < size) {
        return [...prev, ...Array.from({ length: size - prev.length }, () => true)];
      }
      return prev.slice(0, size);
    });
  }, [extras.length]);

  const setGoingAt = (index: number, visible: boolean) => {
    setGoingVisible((prev) => prev.map((v, i) => (i === index ? visible : v)));
  };

  const holderGoing = goingVisible[0] ?? true;

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
        {showGoingOptIn ? (
          <>
            <input type="hidden" name="showOnGoing" value={holderGoing ? "1" : "0"} />
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={holderGoing}
                onChange={(e) => setGoingAt(0, e.target.checked)}
              />
              Appear on Who&apos;s Going
            </label>
          </>
        ) : null}
      </div>
      {extras.map((name, i) => {
        const guestGoing = goingVisible[i + 1] ?? true;
        return (
          <div key={i} className="flex gap-2">
            <div className="flex-1">
              <label className="label">Additional person</label>
              <input
                className="field"
                name="guestName"
                required
                defaultValue={name}
              />
              {showGoingOptIn ? (
                <>
                  <input type="hidden" name="showOnGoing" value={guestGoing ? "1" : "0"} />
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={guestGoing}
                      onChange={(e) => setGoingAt(i + 1, e.target.checked)}
                    />
                    Appear on Who&apos;s Going
                  </label>
                </>
              ) : null}
            </div>
            <button
              type="button"
              className="btn-line mt-6"
              onClick={() => setExtras((list) => list.filter((_, idx) => idx !== i))}
            >
              Remove
            </button>
          </div>
        );
      })}
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
