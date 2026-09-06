"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function AmountsToggle({ showAmounts }: { showAmounts: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={showAmounts}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.checked) {
            params.set("amounts", "1");
          } else {
            params.delete("amounts");
          }
          router.replace(`?${params.toString()}`);
        }}
      />
      Show amounts
    </label>
  );
}

export function PrintButton() {
  return (
    <button className="btn-gold" type="button" onClick={() => window.print()}>
      Print
    </button>
  );
}

export function ChannelFilter({
  channels,
  channelFilter,
}: {
  channels: { id: string; name: string }[];
  channelFilter: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-[var(--mute)]">Channel</span>
      <select
        className="field py-1"
        value={channelFilter}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          const value = e.target.value;
          if (!value || value === "all") params.delete("channel");
          else params.set("channel", value);
          const q = params.toString();
          router.replace(q ? `?${q}` : "?");
        }}
      >
        <option value="all">All channels</option>
        {channels.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
