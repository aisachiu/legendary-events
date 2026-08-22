"use client";

import { useDescope, useSession } from "@descope/nextjs-sdk/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { syncDescopeUserAction } from "@/app/actions/auth";

const SOCIAL = [
  { id: "google", label: "Google" },
  { id: "apple", label: "Apple" },
  { id: "facebook", label: "Facebook" },
  { id: "microsoft", label: "Microsoft" },
] as const;

function errText(err: unknown) {
  if (!err) return "Something went wrong.";
  if (typeof err === "string") return err;
  if (typeof err === "object" && "errorMessage" in err) {
    return String((err as { errorMessage?: string }).errorMessage);
  }
  if (typeof err === "object" && "error" in err) {
    const nested = (err as { error?: { errorMessage?: string; message?: string } }).error;
    return nested?.errorMessage || nested?.message || "Something went wrong.";
  }
  return "Something went wrong.";
}

function toE164(raw: string) {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return `+${digits}`;
}

function finishPath(next: string) {
  return next || "/";
}

export function AuthOtpForm({
  next = "/",
  mode = "login",
}: {
  next?: string;
  mode?: "login" | "register";
}) {
  const sdk = useDescope();
  const { isAuthenticated, isSessionLoading } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [host, setHost] = useState(false);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const finishing = useRef(false);

  async function finish(sessionJwt?: string, extra?: { phone?: string }) {
    const storedHost =
      typeof window !== "undefined" && sessionStorage.getItem("le_host") === "1";
    const storedName =
      typeof window !== "undefined" ? sessionStorage.getItem("le_name") || "" : "";
    const synced = await syncDescopeUserAction({
      name: name.trim() || storedName || undefined,
      phone: extra?.phone,
      host: host || storedHost,
      sessionJwt,
    });
    if (!synced.ok) {
      setError(synced.error);
      return false;
    }
    sessionStorage.removeItem("le_host");
    sessionStorage.removeItem("le_name");
    router.push(finishPath(next));
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
          setError(errText(resp) || "Social sign-in did not finish.");
          finishing.current = false;
          return;
        }
        const jwt =
          resp.data && typeof resp.data === "object" && "sessionJwt" in resp.data
            ? String((resp.data as { sessionJwt?: string }).sessionJwt || "")
            : "";
        await finish(jwt || undefined);
      } catch (e) {
        setError(errText(e));
        finishing.current = false;
      } finally {
        setBusy(false);
      }
    })();
    // sdk identity is stable enough for this page
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

  async function sendCode() {
    setError("");
    const e164 = toE164(phone);
    if (e164.length < 10) {
      setError("Enter a mobile number with country code, e.g. +85255551234.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Name is required.");
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
      const jwt =
        resp.data && typeof resp.data === "object" && "sessionJwt" in resp.data
          ? String((resp.data as { sessionJwt?: string }).sessionJwt || "")
          : "";
      finishing.current = true;
      await finish(jwt || undefined, { phone: e164 });
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function startSocial(provider: string) {
    setError("");
    if (mode === "register" && !name.trim()) {
      setError("Add your name, then continue with a social account.");
      return;
    }
    setBusy(true);
    try {
      sessionStorage.setItem("le_host", host ? "1" : "");
      sessionStorage.setItem("le_name", name.trim());
      const redirect = `${window.location.origin}/login?next=${encodeURIComponent(finishPath(next))}`;
      const resp = await sdk.oauth.start(provider, redirect);
      const url =
        resp.data && typeof resp.data === "object" && "url" in resp.data
          ? String((resp.data as { url?: string }).url || "")
          : "";
      if (!resp.ok || !url) {
        setError(
          errText(resp) ||
            `Could not start ${provider}. Enable that social connector in the Descope console.`,
        );
        return;
      }
      window.location.assign(url);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? <p className="text-sm text-red-800">{error}</p> : null}

      {mode === "register" ? (
        <>
          <div>
            <label className="label">Name</label>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={host} onChange={(e) => setHost(e.target.checked)} />
            I host events
          </label>
        </>
      ) : null}

      <div className="grid gap-2">
        {SOCIAL.map((p) => (
          <button
            key={p.id}
            type="button"
            className="btn-line w-full"
            disabled={busy}
            onClick={() => startSocial(p.id)}
          >
            Continue with {p.label}
          </button>
        ))}
      </div>

      <p className="text-center text-xs uppercase tracking-[0.2em] text-[var(--mute)]">or SMS code</p>

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
          <button className="btn-gold" type="button" disabled={busy} onClick={verifyCode}>
            {busy ? "Checking…" : "Continue"}
          </button>
          <button
            className="block text-sm underline text-[var(--mute)]"
            type="button"
            disabled={busy}
            onClick={sendCode}
          >
            Resend code
          </button>
        </>
      ) : (
        <button className="btn-gold" type="button" disabled={busy} onClick={sendCode}>
          {busy ? "Sending…" : "Text me a code"}
        </button>
      )}
    </div>
  );
}
