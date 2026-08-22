import Link from "next/link";
import { AuthOtpForm } from "@/components/AuthOtpForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-serif text-4xl">Sign in</h1>
      <p className="mt-3 text-sm text-[var(--mute)]">
        We send a text, or you can continue with a social account. No password.
      </p>
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
      {process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID ? (
        <AuthOtpForm next={next || "/"} mode="login" />
      ) : (
        <p className="mt-8 text-sm text-red-800">
          Set <code>NEXT_PUBLIC_DESCOPE_PROJECT_ID</code>, enable phone OTP and social connectors
          in Descope, then restart.
        </p>
      )}
      <p className="mt-6 text-sm">
        New here? <Link className="underline" href={`/register?next=${encodeURIComponent(next || "/")}`}>Create an account</Link>
      </p>
    </div>
  );
}
