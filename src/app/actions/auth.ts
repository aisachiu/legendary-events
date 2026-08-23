"use server";

import { createSdk, session } from "@descope/nextjs-sdk/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isPlaceholderName } from "@/lib/names";

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

export async function sessionJwtAction() {
  const sess = await session();
  return sess?.jwt ?? null;
}

/** Email-first auth: returning users already have a Descope-linked row. */
export async function lookupEmailAction(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!emailOk(email)) {
    return { ok: false as const, error: "Enter a valid email." };
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { descopeUserId: true },
  });
  return {
    ok: true as const,
    email,
    exists: Boolean(user?.descopeUserId),
  };
}

export async function syncDescopeUserAction(input: {
  name?: string;
  email?: string;
  phone?: string;
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
  const tokenName = claimString(token!, "name");
  const name =
    input.name?.trim() ||
    (tokenName && !isPlaceholderName(tokenName, email, phone) ? tokenName : "") ||
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

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          descopeUserId,
          email,
          name: input.name?.trim() || existing.name,
          ...(phone ? { phone } : {}),
          ...(makeAdmin ? { role: "SUPERADMIN" } : {}),
        },
      })
    : await prisma.user.create({
        data: {
          descopeUserId,
          email,
          phone,
          name,
          role: makeAdmin ? "SUPERADMIN" : "ATTENDEE",
        },
      });

  return {
    ok: true as const,
    userId: user.id,
    needsName: isPlaceholderName(user.name, user.email, user.phone),
  };
}

export async function updateNameAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false as const, error: "Sign in first." };
  }
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) {
    return { ok: false as const, error: "Enter the name we should use for you." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { name } });
  return { ok: true as const };
}
