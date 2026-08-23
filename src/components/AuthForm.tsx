"use client";

import { useDescope, useSession } from "@descope/nextjs-sdk/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { syncDescopeUserAction } from "@/app/actions/auth";
import { errText, jwtFromResp, toE164, urlFromResp } from "@/lib/descope-client";

function finishPath(next: string) {
  return next || "/";
}

function afterAuth(next: string, needsName: boolean) {
  if (needsName) {
    return `/account?welcome=1&next=${encodeURIComponent(finishPath(next))}`;
  }
  return finishPath(next);
}

function magicLinkRedirect(next: string) {
  return `${window.location.origin}/login?next=${encodeURIComponent(finishPath(next))}`;
}

export function AuthForm({
  next = "/",
  variant = "full",
}: {
  next?: string;
  variant?: "full" | "compact";
}) {
  const sdk = useDescope();
  const { isAuthenticated, isSessionLoading } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const finishing = useRef(false);

  async function finish(
    sessionJwt?: string,
    extra?: { phone?: string; email?: string; name?: string },
  ) {
    const synced = await syncDescopeUserAction({
      email: extra?.email,
      phone: extra?.phone,
      name: extra?.name,
      sessionJwt,
    });
    if (!synced.ok) {
      setError(synced.error);
      finishing.current = false;
      return false;
    }
    router.push(afterAuth(next, synced.needsName));
    router.refresh();
    return true;
  }

  useEffect(() => {
    if (finishing.current) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("t") || params.get("token");
    if (!token) return;
    finishing.current = true;
    setBusy(true);
    void (async () => {
      try {
        const resp = await sdk.magicLink.verify(token);
        if (!resp.ok) {
          setError(errText(resp) || "That sign-in link is invalid or has expired. Request a new one.");
          finishing.current = false;
          return;
        }
        await finish(jwtFromResp(resp));
      } catch (e) {
        setError(errText(e));
        finishing.current = false;
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (finishing.current) return;
    const params = new URLSearchParams(window.location.search);
    const oauthCode = params.get("code");
    if (!oauthCode) return;
    finishing.current = true;
    setBusy(true);
    void (async () => {
      try {
        const resp = await sdk.oauth.exchange(oauthCode);
        if (!resp.ok) {
          setError(errText(resp) || "Google sign-in did not finish.");
          finishing.current = false;
          return;
        }
        await finish(jwtFromResp(resp));
      } catch (e) {
        setError(errText(e));
        finishing.current = false;
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (finishing.current || isSessionLoading || !isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("code") || params.get("t") || params.get("token")) return;
    finishing.current = true;
    void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isSessionLoading]);

  async function continueWithGoogle() {
    setError("");
    setBusy(true);
    try {
      const redirect = magicLinkRedirect(next);
      const resp = await sdk.oauth.start("google", redirect);
      const url = urlFromResp(resp);
      if (!resp.ok || !url) {
        setError(errText(resp) || "Could not start Google. Enable the Google connector in Descope.");
        setBusy(false);
        return;
      }
      window.location.assign(url);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  async function sendEmailLink() {
    setError("");
    const loginId = email.trim().toLowerCase();
    if (!loginId.includes("@")) {
      setError("Enter your email.");
      return;
    }
    setBusy(true);
    try {
      const resp = await sdk.magicLink.signUpOrIn.email(loginId, magicLinkRedirect(next));
      if (!resp.ok) {
        setError(
          errText(resp) ||
            "Could not send the email link. Enable Magic Link (email) in Descope and add this site to redirect URLs.",
        );
        return;
      }
      setEmail(loginId);
      setEmailSent(true);
      setPhoneSent(false);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoneLink() {
    setError("");
    const e164 = toE164(phone);
    if (e164.length < 10) {
      setError("Enter a mobile number with country code, e.g. +85255551234.");
      return;
    }
    setBusy(true);
    try {
      const resp = await sdk.magicLink.signUpOrIn.sms(e164, magicLinkRedirect(next));
      if (!resp.ok) {
        setError(
          errText(resp) ||
            "Could not send the SMS link. Enable Magic Link (SMS) in Descope and add this site to redirect URLs.",
        );
        return;
      }
      setPhone(e164);
      setPhoneSent(true);
      setEmailSent(false);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={variant === "compact" ? "space-y-4" : "mt-8 space-y-6"}>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}

      <button className="btn-line w-full" type="button" disabled={busy} onClick={continueWithGoogle}>
        Continue with Google
      </button>

      <div className="space-y-3">
        {emailSent ? (
          <>
            <p className="text-sm text-[var(--mute)]">
              Check <span className="text-[var(--ink)]">{email}</span> for a sign-in link. It may take
              a minute.
            </p>
            <button
              className="btn-gold w-full"
              type="button"
              disabled={busy}
              onClick={sendEmailLink}
            >
              {busy ? "Sending…" : "Resend email link"}
            </button>
            <button
              className="text-sm underline text-[var(--mute)]"
              type="button"
              disabled={busy}
              onClick={() => {
                setEmailSent(false);
                setError("");
              }}
            >
              Use a different email
            </button>
          </>
        ) : (
          <>
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
                    void sendEmailLink();
                  }
                }}
              />
            </div>
            <button className="btn-gold w-full" type="button" disabled={busy} onClick={sendEmailLink}>
              {busy ? "Sending…" : "Email me a magic link"}
            </button>
          </>
        )}
      </div>

      <p className="text-center text-xs uppercase tracking-[0.2em] text-[var(--mute)]">or SMS</p>

      <div className="space-y-3">
        {phoneSent ? (
          <>
            <p className="text-sm text-[var(--mute)]">
              Check your texts at <span className="text-[var(--ink)]">{phone}</span> for a sign-in
              link.
            </p>
            <button
              className="btn-gold w-full"
              type="button"
              disabled={busy}
              onClick={sendPhoneLink}
            >
              {busy ? "Sending…" : "Resend SMS link"}
            </button>
            <button
              className="text-sm underline text-[var(--mute)]"
              type="button"
              disabled={busy}
              onClick={() => {
                setPhoneSent(false);
                setError("");
              }}
            >
              Use a different number
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="label">Mobile number</label>
              <input
                className="field"
                type="tel"
                placeholder="+85255551234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void sendPhoneLink();
                  }
                }}
              />
            </div>
            <button className="btn-gold w-full" type="button" disabled={busy} onClick={sendPhoneLink}>
              {busy ? "Sending…" : "Text me a magic link"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
