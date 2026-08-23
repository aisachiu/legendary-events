"use client";

import { useDescope, useSession } from "@descope/nextjs-sdk/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { syncDescopeUserAction } from "@/app/actions/auth";
import {
  errText,
  jwtFromResp,
  loginIdFromResp,
  refreshJwtFromResp,
} from "@/lib/descope-client";
import { RESET_NEXT_KEY } from "@/lib/password-reset";

function tokenFromSearch() {
  const params = new URLSearchParams(window.location.search);
  return params.get("t") || params.get("token") || "";
}

export function ResetPasswordForm() {
  const sdk = useDescope();
  const { sessionToken } = useSession();
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [refreshJwt, setRefreshJwt] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const verifying = useRef(false);

  useEffect(() => {
    if (verifying.current) return;
    const token = tokenFromSearch();
    if (!token) {
      setBusy(false);
      setError("This reset link is missing its token. Request a new one from the sign-in page.");
      return;
    }
    verifying.current = true;
    void (async () => {
      try {
        const resp = await sdk.magicLink.verify(token);
        if (!resp.ok) {
          setError(errText(resp) || "This reset link is invalid or has expired. Request a new one.");
          return;
        }
        const id = loginIdFromResp(resp);
        if (!id) {
          setError("We could not read the account from that link. Request a new reset email.");
          return;
        }
        setLoginId(id);
        setRefreshJwt(refreshJwtFromResp(resp) || "");
        setReady(true);
      } catch (e) {
        setError(errText(e));
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function savePassword() {
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const token = refreshJwt || sessionToken || undefined;
      const resp = await sdk.password.update(loginId, password, token);
      if (!resp.ok) {
        setError(errText(resp) || "Could not save the new password.");
        return;
      }
      const synced = await syncDescopeUserAction({
        email: loginId,
        sessionJwt: jwtFromResp(resp) || sessionToken || undefined,
      });
      if (!synced.ok) {
        setError(synced.error);
        return;
      }
      const nextPath =
        (typeof window !== "undefined" && localStorage.getItem(RESET_NEXT_KEY)) || "/";
      localStorage.removeItem(RESET_NEXT_KEY);
      router.push(synced.needsName ? `/account?welcome=1&next=${encodeURIComponent(nextPath)}` : nextPath);
      router.refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {busy && !ready ? <p className="text-sm text-[var(--mute)]">Checking your reset link…</p> : null}
      {ready ? (
        <>
          <p className="text-sm text-[var(--mute)]">
            Choose a new password for <span className="text-[var(--ink)]">{loginId}</span>.
          </p>
          <div>
            <label className="label">New password</label>
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void savePassword();
                }
              }}
            />
          </div>
          <button className="btn-gold w-full" type="button" disabled={busy} onClick={() => void savePassword()}>
            {busy ? "Saving…" : "Save password and sign in"}
          </button>
        </>
      ) : !busy ? (
        <Link className="btn-line inline-flex" href="/forgot-password">
          Request a new link
        </Link>
      ) : null}
    </div>
  );
}
