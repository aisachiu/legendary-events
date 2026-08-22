"use client";

import { useDescope, useSession, useUser } from "@descope/nextjs-sdk/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sessionJwtAction, updateNameAction } from "@/app/actions/auth";
import { errText, toE164, urlFromResp } from "@/lib/descope-client";

type DescopeUser = {
  email?: string;
  phone?: string;
  name?: string;
  loginIds?: string[];
  OAuth?: Record<string, unknown>;
  oauth?: Record<string, unknown>;
};

function loginIdOf(user: DescopeUser | undefined) {
  return user?.loginIds?.[0] || user?.email || user?.phone || "";
}

function hasGoogle(user: DescopeUser | undefined) {
  if (!user) return false;
  if (user.OAuth?.google || user.oauth?.google) return true;
  return (user.loginIds || []).some((id) => id.toLowerCase().includes("google"));
}

function isRealEmail(email?: string) {
  return Boolean(email && email.includes("@") && !email.endsWith("@phone.legendary.events"));
}

export function AccountPanel({
  name,
  welcome,
  next = "/",
}: {
  name: string;
  welcome?: boolean;
  next?: string;
}) {
  const sdk = useDescope();
  const { user, isUserLoading } = useUser();
  const { sessionToken } = useSession();
  const router = useRouter();
  const descopeUser = user as DescopeUser | undefined;

  const [displayName, setDisplayName] = useState(name);
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthCode = params.get("code");
    if (!oauthCode) return;
    void (async () => {
      setBusy(true);
      try {
        const resp = await sdk.oauth.exchange(oauthCode);
        if (!resp.ok) {
          setError(errText(resp) || "Could not link Google.");
          return;
        }
        setMessage("Google is linked.");
        router.replace("/account");
        router.refresh();
      } catch (e) {
        setError(errText(e));
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function token() {
    return sessionToken || (await sessionJwtAction()) || "";
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = new FormData();
      data.set("name", displayName);
      const result = await updateNameAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (welcome) {
        router.push(next || "/");
        router.refresh();
        return;
      }
      setMessage("Name saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function linkGoogle() {
    setError("");
    setBusy(true);
    try {
      const jwt = await token();
      const redirect = `${window.location.origin}/account`;
      const resp = await sdk.oauth.start("google", redirect, undefined, jwt || undefined);
      const url = urlFromResp(resp);
      if (!resp.ok || !url) {
        setError(errText(resp) || "Could not start Google linking.");
        setBusy(false);
        return;
      }
      window.location.assign(url);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  async function sendPhoneCode() {
    setError("");
    const e164 = toE164(phone);
    const id = loginIdOf(descopeUser);
    if (!id) {
      setError("Sign in again, then link a phone.");
      return;
    }
    if (e164.length < 10) {
      setError("Enter a mobile number with country code.");
      return;
    }
    setBusy(true);
    try {
      const jwt = await token();
      const resp = await sdk.otp.update.phone.sms(id, e164, jwt || undefined);
      if (!resp.ok) {
        setError(errText(resp) || "Could not send the SMS.");
        return;
      }
      setSmsSent(true);
      setMessage("We texted a code.");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhone() {
    setError("");
    setBusy(true);
    try {
      const e164 = toE164(phone);
      const resp = await sdk.otp.verify.sms(e164, smsCode.trim());
      if (!resp.ok) {
        setError(errText(resp) || "That code did not work.");
        return;
      }
      setMessage("Phone is linked.");
      setSmsSent(false);
      router.refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendEmailCode() {
    setError("");
    const id = loginIdOf(descopeUser);
    const addr = email.trim().toLowerCase();
    if (!id || !addr.includes("@")) {
      setError("Enter the email to link.");
      return;
    }
    setBusy(true);
    try {
      const jwt = await token();
      const resp = await sdk.otp.update.email(id, addr, jwt || undefined);
      if (!resp.ok) {
        setError(errText(resp) || "Could not send the email code.");
        return;
      }
      setEmailSent(true);
      setMessage("We emailed a code.");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail() {
    setError("");
    setBusy(true);
    try {
      const addr = email.trim().toLowerCase();
      const resp = await sdk.otp.verify.email(addr, emailCode.trim());
      if (!resp.ok) {
        setError(errText(resp) || "That code did not work.");
        return;
      }
      setMessage("Email is linked.");
      setEmailSent(false);
      router.refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    setError("");
    const id = descopeUser?.email || loginIdOf(descopeUser);
    if (!isRealEmail(id)) {
      setError("Link a real email before setting a password.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const jwt = await token();
      const updated = await sdk.password.update(id, password, jwt || undefined);
      const created = updated.ok
        ? updated
        : await sdk.password.signUp(id, password, { email: id });
      if (!created.ok) {
        setError(errText(created) || "Could not set the password.");
        return;
      }
      setPassword("");
      setMessage("Password saved.");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  if (isUserLoading) {
    return <p className="mt-8 text-sm text-[var(--mute)]">Loading your sign-in methods…</p>;
  }

  if (welcome) {
    return (
      <form onSubmit={saveName} className="mt-8 space-y-4">
        <p className="text-sm text-[var(--mute)]">What should we call you?</p>
        {error ? <p className="text-sm text-red-800">{error}</p> : null}
        <div>
          <label className="label">Your name</label>
          <input
            className="field"
            value={displayName === "Guest" ? "" : displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            minLength={2}
          />
        </div>
        <button className="btn-gold" type="submit" disabled={busy}>
          Continue
        </button>
      </form>
    );
  }

  const googleOn = hasGoogle(descopeUser);
  const phoneOn = Boolean(descopeUser?.phone);
  const emailOn = isRealEmail(descopeUser?.email);

  return (
    <div className="mt-8 space-y-10">
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--gold-ink)]">{message}</p> : null}

      <form onSubmit={saveName} className="space-y-3">
        <h2 className="font-serif text-2xl">Name</h2>
        <input className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <button className="btn-gold" type="submit" disabled={busy}>
          Save name
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Google</h2>
        {googleOn ? (
          <p className="text-sm text-[var(--mute)]">Linked.</p>
        ) : (
          <button className="btn-line" type="button" disabled={busy} onClick={linkGoogle}>
            Link Google
          </button>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Phone</h2>
        {phoneOn ? (
          <p className="text-sm text-[var(--mute)]">{descopeUser?.phone}</p>
        ) : null}
        <input
          className="field"
          type="tel"
          placeholder="+85255551234"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {smsSent ? (
          <>
            <input
              className="field"
              inputMode="numeric"
              placeholder="SMS code"
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value)}
            />
            <button className="btn-gold" type="button" disabled={busy} onClick={verifyPhone}>
              Verify phone
            </button>
          </>
        ) : (
          <button className="btn-line" type="button" disabled={busy} onClick={sendPhoneCode}>
            {phoneOn ? "Change phone" : "Link phone"}
          </button>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Email and password</h2>
        {emailOn ? (
          <p className="text-sm text-[var(--mute)]">{descopeUser?.email}</p>
        ) : (
          <>
            <p className="text-sm text-[var(--mute)]">Link an email before setting a password.</p>
            <input
              className="field"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {emailSent ? (
              <>
                <input
                  className="field"
                  placeholder="Email code"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                />
                <button className="btn-gold" type="button" disabled={busy} onClick={verifyEmail}>
                  Verify email
                </button>
              </>
            ) : (
              <button className="btn-line" type="button" disabled={busy} onClick={sendEmailCode}>
                Link email
              </button>
            )}
          </>
        )}
        {emailOn ? (
          <>
            <label className="label">New password</label>
            <input
              className="field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="btn-gold" type="button" disabled={busy} onClick={savePassword}>
              Save password
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
}
