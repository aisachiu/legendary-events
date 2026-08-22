import type { SessionUser } from "@/lib/auth";

export function isSuperadmin(user: Pick<SessionUser, "role"> | null | undefined) {
  return user?.role === "SUPERADMIN";
}

export function canHost(user: Pick<SessionUser, "role"> | null | undefined) {
  return user?.role === "ORGANIZER" || user?.role === "SUPERADMIN";
}

export function canManageEvent(
  user: Pick<SessionUser, "id" | "role"> | null | undefined,
  organizerId: string,
) {
  if (!user) return false;
  return isSuperadmin(user) || user.id === organizerId;
}
