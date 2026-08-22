import Link from "next/link";
import { registerAction } from "@/app/actions/auth";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-serif text-4xl">Create an account</h1>
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
      <form action={registerAction} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next || "/"} />
        <div>
          <label className="label">Name</label>
          <input className="field" name="name" required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="field" name="email" type="email" required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="field" name="password" type="password" minLength={8} required />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="host" />
          I host events
        </label>
        <button className="btn-gold" type="submit">
          Create account
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already here? <Link className="underline" href="/login">Sign in</Link>
      </p>
    </div>
  );
}
