"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  checkPassword,
  clearSession,
  hashPassword,
  setSession,
} from "@/lib/auth";

function emailOk(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function registerAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const host = formData.get("host") === "on";
  const next = String(formData.get("next") || "/");

  if (!name || !emailOk(email) || password.length < 8) {
    redirect(
      `/register?error=${encodeURIComponent("Name, a valid email, and a password of 8+ characters are required.")}&next=${encodeURIComponent(next)}`,
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect(
      `/register?error=${encodeURIComponent("That email is already registered. Sign in instead.")}&next=${encodeURIComponent(next)}`,
    );
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: host ? "ORGANIZER" : "ATTENDEE",
    },
  });

  await setSession(user.id);
  redirect(next || "/");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await checkPassword(password, user.passwordHash))) {
    redirect(
      `/login?error=${encodeURIComponent("Email or password is wrong.")}&next=${encodeURIComponent(next)}`,
    );
  }

  await setSession(user.id);
  redirect(next || "/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}
