"use server";

import { createSdk, session } from "@descope/nextjs-sdk/server";
import { prisma } from "@/lib/prisma";

function emailOk(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function phoneEmail(phone: string) {
  return `${phone.replace(/\D/g, "")}@phone.legendary.events`;
}

function claimString(token: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = token[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function syncDescopeUserAction(input: {
  name?: string;
  email?: string;
  phone?: string;
  host?: boolean;
  sessionJwt?: string;
}) {
  let token: Record<string, unknown> | undefined;
  try {
    if (input.sessionJwt) {
      const info = await createSdk().validateJwt(input.sessionJwt);
      token = info.token as Record<string, unknown>;
    } else {
      const sess = await session();
      token = sess?.token as Record<string, unknown> | undefined;
    }
  } catch {
    return { ok: false as const, error: "Sign-in did not finish. Try the code again." };
  }
  const descopeUserId = claimString(token ?? {}, "sub");
  if (!descopeUserId) {
    return { ok: false as const, error: "Sign-in did not finish. Try the code again." };
  }

  const emailRaw = (input.email || claimString(token!, "email") || "").trim().toLowerCase();
  const phone = input.phone?.trim() || claimString(token!, "phone", "phoneNumber");
  const email = emailOk(emailRaw) ? emailRaw : phone ? phoneEmail(phone) : "";
  const name =
    input.name?.trim() ||
    claimString(token!, "name") ||
    (emailOk(emailRaw) ? emailRaw.split("@")[0] : phone || "Guest");

  if (!emailOk(email)) {
    return { ok: false as const, error: "Sign-in did not return an email or phone we can store." };
  }

  const adminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const makeAdmin = Boolean(adminEmail && email === adminEmail);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { descopeUserId },
        { email },
        ...(phone ? [{ phone }] : []),
      ],
    },
  });

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        descopeUserId,
        email,
        name: input.name?.trim() || existing.name,
        ...(phone ? { phone } : {}),
        ...(input.host && existing.role === "ATTENDEE" ? { role: "ORGANIZER" } : {}),
        ...(makeAdmin ? { role: "SUPERADMIN" } : {}),
      },
    });
    return { ok: true as const, userId: user.id };
  }

  const user = await prisma.user.create({
    data: {
      descopeUserId,
      email,
      phone,
      name,
      role: makeAdmin ? "SUPERADMIN" : input.host ? "ORGANIZER" : "ATTENDEE",
    },
  });
  return { ok: true as const, userId: user.id };
}
