export function errText(err: unknown) {
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

export function isUserNotFound(err: unknown) {
  const t = errText(err).toLowerCase();
  return (
    t.includes("not found") ||
    t.includes("does not exist") ||
    t.includes("no user") ||
    t.includes("user not") ||
    t.includes("couldn't find") ||
    t.includes("could not find")
  );
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
