import { AuthForm } from "@/components/AuthForm";

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
        Google, email and password, or a text to your phone. Enter your email first — we&apos;ll
        sign you in or collect a name and password to create your account.
      </p>
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
      {process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID ? (
        <AuthForm next={next || "/"} />
      ) : (
        <p className="mt-8 text-sm text-red-800">
          Set <code>NEXT_PUBLIC_DESCOPE_PROJECT_ID</code>, enable Google, Password, and SMS OTP in
          Descope, then restart.
        </p>
      )}
    </div>
  );
}
