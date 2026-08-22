import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/auth";
import { canHost, isSuperadmin } from "@/lib/roles";

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
              {canHost(user) ? "Host desk" : "Your tickets"}
            </Link>
          ) : null}
          {isSuperadmin(user) ? (
            <Link href="/admin" className="text-[var(--mute)] hover:text-[var(--ink)]">
              Admin
            </Link>
          ) : null}
          {user ? (
            <form action={logoutAction}>
              <button type="submit" className="text-[var(--mute)] hover:text-[var(--ink)]">
                Sign out {user.name.split(" ")[0]}
              </button>
            </form>
          ) : (
            <>
              <Link href="/login" className="text-[var(--mute)] hover:text-[var(--ink)]">
                Sign in
              </Link>
              <Link href="/register" className="btn-gold">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
