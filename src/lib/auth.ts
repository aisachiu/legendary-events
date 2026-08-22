import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const COOKIE = "le_session";

function secret() {
  return process.env.AUTH_SECRET || "dev-only-change-me";
}

function sign(userId: string) {
  const hmac = createHmac("sha256", secret()).update(userId).digest("hex");
  return `${userId}.${hmac}`;
}

function verify(token: string) {
  const idx = token.indexOf(".");
  if (idx < 1) return null;
  const userId = token.slice(0, idx);
  const given = token.slice(idx + 1);
  const expected = createHmac("sha256", secret()).update(userId).digest("hex");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function checkPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const userId = verify(token);
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
