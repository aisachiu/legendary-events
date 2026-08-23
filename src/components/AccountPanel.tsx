"use client";

import { useDescope, useSession, useUser } from "@descope/nextjs-sdk/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sessionJwtAction, syncDescopeUserAction, updateNameAction } from "@/app/actions/auth";
import { errText, jwtFromResp, toE164, urlFromResp } from "@/lib/descope-client";

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
  const verifying = useRef(false);

  // Welcome only runs when sync flagged needsName — start blank, don't show "Guest"/email local-part.
  const [displayName, setDisplayName] = useState(() => (welcome ? "" : name));
  const [phone, setPhone] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (verifying.current) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("t") || params.get("token");
    if (!token) return;
    verifying.current = true;
    void (async () => {
      setBusy(true);
      try {
        const resp = await sdk.magicLink.verify(token);
        if (!resp.ok) {
          setError(errText(resp) || "That link is invalid or has expired. Request a new one.");
          return;
        }
        const synced = await syncDescopeUserAction({ sessionJwt: jwtFromResp(resp) });
        if (!synced.ok) {
          setError(synced.error);
          return;
        }
        setMessage("Sign-in method updated.");
        setEmailSent(false);
        setPhoneSent(false);
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

  async function sendPhoneLink() {
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
      const redirect = `${window.location.origin}/account`;
      const resp = await sdk.magicLink.update.phone.sms(id, e164, redirect, jwt || undefined);
      if (!resp.ok) {
        setError(errText(resp) || "Could not send the SMS link.");
        return;
      }
      setPhone(e164);
      setPhoneSent(true);
      setMessage("We texted a link to confirm this number.");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendEmailLink() {
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
      const redirect = `${window.location.origin}/account`;
      const resp = await sdk.magicLink.update.email(id, addr, redirect, jwt || undefined);
      if (!resp.ok) {
        setError(errText(resp) || "Could not send the email link.");
        return;
      }
      setEmail(addr);
      setEmailSent(true);
      setMessage("We emailed a link to confirm this address.");
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
        <p className="text-sm text-[var(--mute)]">
          Hosts and guests see this name on events. One quick step after your magic link.
        </p>
        {error ? <p className="text-sm text-red-800">{error}</p> : null}
        <div>
          <label className="label">Your name</label>
          <input
            className="field"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            minLength={2}
            autoFocus
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
        {phoneSent ? (
          <>
            <p className="text-sm text-[var(--mute)]">
              Open the link we texted to <span className="text-[var(--ink)]">{phone}</span>.
            </p>
            <button className="btn-gold" type="button" disabled={busy} onClick={sendPhoneLink}>
              Resend SMS link
            </button>
          </>
        ) : (
          <button className="btn-line" type="button" disabled={busy} onClick={sendPhoneLink}>
            {phoneOn ? "Change phone" : "Link phone"}
          </button>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Email</h2>
        {emailOn ? (
          <p className="text-sm text-[var(--mute)]">{descopeUser?.email}</p>
        ) : (
          <p className="text-sm text-[var(--mute)]">
            Link an email so you can sign in with a magic link.
          </p>
        )}
        <input
          className="field"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {emailSent ? (
          <>
            <p className="text-sm text-[var(--mute)]">
              Open the link we emailed to <span className="text-[var(--ink)]">{email}</span>.
            </p>
            <button className="btn-gold" type="button" disabled={busy} onClick={sendEmailLink}>
              Resend email link
            </button>
          </>
        ) : (
          <button className="btn-line" type="button" disabled={busy} onClick={sendEmailLink}>
            {emailOn ? "Change email" : "Link email"}
          </button>
        )}
      </section>
    </div>
  );
}
