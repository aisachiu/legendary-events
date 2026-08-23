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
