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
