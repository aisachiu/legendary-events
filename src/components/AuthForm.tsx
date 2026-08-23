"use client";

import { useDescope, useSession } from "@descope/nextjs-sdk/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { lookupEmailAction, syncDescopeUserAction } from "@/app/actions/auth";
import {
  errText,
  isUserAlreadyExists,
  isUserNotFound,
  jwtFromResp,
  toE164,
  urlFromResp,
} from "@/lib/descope-client";
import { forgotPasswordHref } from "@/lib/password-reset";

type EmailStep = "email" | "login" | "signup";

function finishPath(next: string) {
  return next || "/";
}

function afterAuth(next: string, needsName: boolean) {
  if (needsName) {
    return `/account?welcome=1&next=${encodeURIComponent(finishPath(next))}`;
  }
  return finishPath(next);
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
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [emailStep, setEmailStep] = useState<EmailStep>("email");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
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
    if (params.get("code")) return;
    finishing.current = true;
    void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isSessionLoading]);

  function resetEmailFlow() {
    setEmailStep("email");
    setPassword("");
    setName("");
    setError("");
  }

  async function continueWithGoogle() {
    setError("");
    setBusy(true);
    try {
      const redirect = `${window.location.origin}/login?next=${encodeURIComponent(finishPath(next))}`;
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

  async function continueWithEmail() {
    setError("");
    const loginId = email.trim().toLowerCase();
    if (!loginId.includes("@")) {
      setError("Enter your email.");
      return;
    }
    setBusy(true);
    try {
      const looked = await lookupEmailAction(loginId);
      if (!looked.ok) {
        setError(looked.error);
        return;
      }
      setEmail(looked.email);
      setPassword("");
      setName("");
      setEmailStep(looked.exists ? "login" : "signup");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword() {
    setError("");
    const loginId = email.trim().toLowerCase();
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (emailStep === "signup" && name.trim().length < 2) {
      setError("Enter the name we should use for you.");
      return;
    }
    setBusy(true);
    try {
      if (emailStep === "signup") {
        const displayName = name.trim();
        const resp = await sdk.password.signUp(loginId, password, {
          email: loginId,
          name: displayName,
        });
        if (!resp.ok) {
          if (isUserAlreadyExists(resp)) {
            setEmailStep("login");
            setPassword("");
            setError("That email already has an account. Enter your password to sign in.");
            return;
          }
          setError(errText(resp) || "Could not create your account.");
          return;
        }
        finishing.current = true;
        await finish(jwtFromResp(resp), { email: loginId, name: displayName });
        return;
      }

      const resp = await sdk.password.signIn(loginId, password);
      if (!resp.ok) {
        if (isUserNotFound(resp)) {
          setEmailStep("signup");
          setPassword("");
          setError("No account for that email yet. Choose a password to sign up.");
          return;
        }
        setError(errText(resp) || "Email or password did not work.");
        return;
      }
      finishing.current = true;
      await finish(jwtFromResp(resp), { email: loginId });
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setError("");
    const e164 = toE164(phone);
    if (e164.length < 10) {
      setError("Enter a mobile number with country code, e.g. +85255551234.");
      return;
    }
    setBusy(true);
    try {
      const resp = await sdk.otp.signUpOrIn.sms(e164);
      if (!resp.ok) {
        setError(errText(resp) || "Could not send an SMS. Enable phone OTP in Descope.");
        return;
      }
      setSent(true);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setError("");
    if (code.trim().length < 4) {
      setError("Enter the SMS code.");
      return;
    }
    setBusy(true);
    try {
      const e164 = toE164(phone);
      const resp = await sdk.otp.verify.sms(e164, code.trim());
      if (!resp.ok) {
        setError(errText(resp) || "That code did not work.");
        return;
      }
      finishing.current = true;
      await finish(jwtFromResp(resp), { phone: e164 });
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
        {emailStep === "email" ? (
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
                    void continueWithEmail();
                  }
                }}
              />
            </div>
            <button className="btn-gold w-full" type="button" disabled={busy} onClick={continueWithEmail}>
              {busy ? "Checking…" : "Continue with email"}
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="label">Email</label>
              <div className="flex items-center gap-3">
                <input className="field flex-1" type="email" value={email} readOnly />
                <button
                  className="shrink-0 text-sm underline text-[var(--mute)]"
                  type="button"
                  disabled={busy}
                  onClick={resetEmailFlow}
                >
                  Change
                </button>
              </div>
            </div>
            {emailStep === "signup" ? (
              <div>
                <label className="label">Your name</label>
                <input
                  className="field"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            ) : null}
            <div>
              <label className="label">Password</label>
              <input
                className="field"
                type="password"
                autoComplete={emailStep === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submitPassword();
                  }
                }}
              />
            </div>
            <button className="btn-gold w-full" type="button" disabled={busy} onClick={submitPassword}>
              {busy
                ? "Working…"
                : emailStep === "signup"
                  ? "Create account"
                  : "Sign in"}
            </button>
            {emailStep === "login" ? (
              <p className="text-xs text-[var(--mute)]">
                <Link className="underline" href={forgotPasswordHref(email, next)}>
                  Forgot password?
                </Link>
                {" · "}
                Usually use Google? Continue with Google above instead.
              </p>
            ) : null}
          </>
        )}
      </div>

      <p className="text-center text-xs uppercase tracking-[0.2em] text-[var(--mute)]">or SMS</p>

      <div className="space-y-3">
        <div>
          <label className="label">Mobile number</label>
          <input
            className="field"
            type="tel"
            placeholder="+85255551234"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        {sent ? (
          <>
            <div>
              <label className="label">One-time code</label>
              <input
                className="field"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <button className="btn-gold w-full" type="button" disabled={busy} onClick={verifyCode}>
              {busy ? "Checking…" : "Continue"}
            </button>
            <button className="text-sm underline text-[var(--mute)]" type="button" disabled={busy} onClick={sendCode}>
              Resend code
            </button>
          </>
        ) : (
          <button className="btn-gold w-full" type="button" disabled={busy} onClick={sendCode}>
            {busy ? "Sending…" : "Text me a code"}
          </button>
        )}
      </div>
    </div>
  );
}
