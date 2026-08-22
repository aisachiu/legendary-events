import { session } from "@descope/nextjs-sdk/server";
import { prisma } from "./prisma";
import { isPlaceholderName } from "./names";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const;

function claimString(token: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = token[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function getCurrentUser() {
  if (!process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID) return null;

  let token: Record<string, unknown> | undefined;
  try {
    const sess = await session();
    token = sess?.token as Record<string, unknown> | undefined;
  } catch {
    return null;
  }
  const descopeUserId = claimString(token ?? {}, "sub");
  if (!descopeUserId) return null;

  const emailRaw = claimString(token!, "email");
  const email = emailRaw ? emailRaw.toLowerCase() : null;
  const phone = claimString(token!, "phone", "phoneNumber");

  const found = await prisma.user.findFirst({
    where: {
      OR: [
        { descopeUserId },
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: { ...userSelect, descopeUserId: true, phone: true },
  });

  if (found) {
    const needsLink =
      found.descopeUserId !== descopeUserId || (phone && found.phone !== phone);
    if (!needsLink) {
      return { id: found.id, email: found.email, name: found.name, role: found.role };
    }
    return prisma.user.update({
      where: { id: found.id },
      data: {
        descopeUserId,
        ...(phone && !found.phone ? { phone } : {}),
      },
      select: userSelect,
    });
  }

  if (!email && !phone) return null;

  const createdEmail = email || `${phone!.replace(/\D/g, "")}@phone.legendary.events`;
  const tokenName = claimString(token!, "name");
  const name =
    tokenName && !isPlaceholderName(tokenName, createdEmail, phone)
      ? tokenName
      : tokenName || createdEmail.split("@")[0] || phone || "Guest";

  return prisma.user.create({
    data: {
      descopeUserId,
      email: createdEmail,
      phone,
      name,
      role: "ATTENDEE",
    },
    select: userSelect,
  });
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
