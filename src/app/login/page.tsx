import Link from "next/link";
import { loginAction } from "@/app/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-serif text-4xl">Sign in</h1>
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
      <form action={loginAction} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next || "/"} />
        <div>
          <label className="label">Email</label>
          <input className="field" name="email" type="email" required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="field" name="password" type="password" required />
        </div>
        <button className="btn-gold" type="submit">
          Sign in
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--mute)]">
        Demo host: host@legendary.events / legendary
        <br />
        Demo guest: guest@legendary.events / legendary
        <br />
        Superadmin: admin@legendary.events / legendary
      </p>
      <p className="mt-4 text-sm">
        No account? <Link className="underline" href="/register">Create one</Link>
      </p>
    </div>
  );
}
