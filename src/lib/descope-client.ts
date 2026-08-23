type DescopeErr = {
  errorCode?: string;
  errorDescription?: string;
  errorMessage?: string;
  message?: string;
};

function asErr(err: unknown): DescopeErr | null {
  if (!err || typeof err !== "object") return null;
  if ("errorCode" in err || "errorDescription" in err || "errorMessage" in err) {
    return err as DescopeErr;
  }
  if ("error" in err && (err as { error?: unknown }).error && typeof (err as { error: unknown }).error === "object") {
    return (err as { error: DescopeErr }).error;
  }
  return null;
}

export function errorCode(err: unknown) {
  return asErr(err)?.errorCode || "";
}

export function errText(err: unknown) {
  if (!err) return "Something went wrong.";
  if (typeof err === "string") return err;
  const nested = asErr(err);
  if (nested) {
    return (
      nested.errorMessage ||
      nested.errorDescription ||
      nested.message ||
      "Something went wrong."
    );
  }
  return "Something went wrong.";
}

function haystack(err: unknown) {
  const nested = asErr(err);
  return [
    errorCode(err),
    nested?.errorDescription,
    nested?.errorMessage,
    nested?.message,
    errText(err),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Descope E062108 — or message text when the code is missing. */
export function isUserNotFound(err: unknown) {
  const code = errorCode(err);
  if (code === "E062108") return true;
  const t = haystack(err);
  return (
    t.includes("not found") ||
    t.includes("does not exist") ||
    t.includes("does not exists") ||
    t.includes("no user") ||
    t.includes("user not") ||
    t.includes("couldn't find") ||
    t.includes("could not find")
  );
}

/** Descope E062107 — sign-up when the login id already exists. */
export function isUserAlreadyExists(err: unknown) {
  const code = errorCode(err);
  if (code === "E062107") return true;
  const t = haystack(err);
  return t.includes("already exists") || t.includes("user already");
}

export function toE164(raw: string) {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return `+${digits}`;
}

export function jwtFromResp(resp: { data?: unknown }) {
  if (resp.data && typeof resp.data === "object" && "sessionJwt" in resp.data) {
    return String((resp.data as { sessionJwt?: string }).sessionJwt || "") || undefined;
  }
  return undefined;
}

export function urlFromResp(resp: { data?: unknown }) {
  if (resp.data && typeof resp.data === "object" && "url" in resp.data) {
    return String((resp.data as { url?: string }).url || "");
  }
  return "";
}
