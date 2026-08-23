/** Canonical public site origin. Used for shareable event links. */
export const CANONICAL_PRODUCTION_ORIGIN = "https://hklegends-events.vercel.app";

const RETIRED_ORIGINS = ["legendary-events-opal.vercel.app"];

function stripSlash(value: string) {
  return value.replace(/\/$/, "");
}

function looksRetired(value: string) {
  return RETIRED_ORIGINS.some((host) => value.includes(host));
}

export function appOrigin() {
  const fromEnv = stripSlash((process.env.NEXT_PUBLIC_APP_URL || "").trim());
  if (fromEnv && !looksRetired(fromEnv)) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return CANONICAL_PRODUCTION_ORIGIN;
  }
  return fromEnv || "http://localhost:3000";
}

export function appUrl() {
  return appOrigin();
}
