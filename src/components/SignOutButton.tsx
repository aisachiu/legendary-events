"use client";

import { useDescope } from "@descope/nextjs-sdk/client";
import { useRouter } from "next/navigation";

export function SignOutButton({ label }: { label: string }) {
  const sdk = useDescope();
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-[var(--mute)] hover:text-[var(--ink)]"
      onClick={async () => {
        await sdk.logout();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out {label}
    </button>
  );
}
