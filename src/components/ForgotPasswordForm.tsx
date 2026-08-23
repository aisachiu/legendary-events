"use client";

import { useDescope } from "@descope/nextjs-sdk/client";
import Link from "next/link";
import { useState } from "react";
import { errText, isUserNotFound } from "@/lib/descope-client";
import { RESET_NEXT_KEY, resetPasswordPath } from "@/lib/password-reset";

export function ForgotPasswordForm({
  defaultEmail = "",
  next = "/",
}: {
  defaultEmail?: string;
  next?: string;
}) {
  const sdk = useDescope();
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function sendReset() {
    setError("");
    const loginId = email.trim().toLowerCase();
    if (!loginId.includes("@")) {
      setError("Enter the email you sign in with.");
      return;
    }
    setBusy(true);
    try {
      if (typeof window !== "undefined") {
        if (next && next !== "/") localStorage.setItem(RESET_NEXT_KEY, next);
        else localStorage.removeItem(RESET_NEXT_KEY);
      }
      const redirect = `${window.location.origin}${resetPasswordPath()}`;
      const resp = await sdk.password.sendReset(loginId, redirect);
      if (!resp.ok && !isUserNotFound(resp)) {
        setError(
          errText(resp) ||
            "Could not send a reset email. In Descope, enable Password reset with Magic Link and add this site to redirect URLs.",
        );
        return;
      }
      setEmail(loginId);
      setSent(true);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-8 space-y-4">
        <p className="text-sm text-[var(--mute)]">
          If an account exists for <span className="text-[var(--ink)]">{email}</span>, we sent a
          reset link. It may take a minute. The email must already be verified in Descope.
        </p>
        <Link className="btn-line inline-flex" href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <div>
        <label className="label">Email</label>
        <input
          className="field"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void sendReset();
            }
          }}
        />
      </div>
      <button className="btn-gold w-full" type="button" disabled={busy} onClick={() => void sendReset()}>
        {busy ? "Sending…" : "Email me a reset link"}
      </button>
      <Link className="block text-center text-sm underline text-[var(--mute)]" href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
        Back to sign in
      </Link>
    </div>
  );
}
