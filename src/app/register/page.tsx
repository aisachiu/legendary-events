import Link from "next/link";
import { AuthOtpForm } from "@/components/AuthOtpForm";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-serif text-4xl">Create an account</h1>
      <p className="mt-3 text-sm text-[var(--mute)]">
        Verify with a phone code or a social account. If you already have an account, this signs you in.
      </p>
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
      {process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID ? (
        <AuthOtpForm next={next || "/"} mode="register" />
      ) : (
        <p className="mt-8 text-sm text-red-800">
          Set <code>NEXT_PUBLIC_DESCOPE_PROJECT_ID</code>, enable phone OTP and social connectors
          in Descope, then restart.
        </p>
      )}
      <p className="mt-4 text-sm">
        Already here? <Link className="underline" href={`/login?next=${encodeURIComponent(next || "/")}`}>Sign in</Link>
      </p>
    </div>
  );
}
