import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import type { SessionUser } from "@/lib/auth";
import { isSuperadmin } from "@/lib/roles";

export function Header({ user }: { user: SessionUser | null }) {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="font-serif text-xl tracking-tight text-[var(--ink)]">
          Legendary Events
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-[var(--mute)] hover:text-[var(--ink)]">
            Events
          </Link>
          {user ? (
            <Link href="/dashboard" className="text-[var(--mute)] hover:text-[var(--ink)]">
              Dashboard
            </Link>
          ) : null}
          {isSuperadmin(user) ? (
            <Link href="/admin" className="text-[var(--mute)] hover:text-[var(--ink)]">
              Admin
            </Link>
          ) : null}
          {user ? (
            <>
              <Link href="/account" className="text-[var(--mute)] hover:text-[var(--ink)]">
                Account
              </Link>
              <SignOutButton label={user.name.split(" ")[0]} />
            </>
          ) : (
            <Link href="/login" className="btn-gold">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
