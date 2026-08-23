import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email, next } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-serif text-4xl">Forgot password</h1>
      <p className="mt-3 text-sm text-[var(--mute)]">
        We&apos;ll email a link to choose a new password. This only works for accounts that sign in
        with email and password.
      </p>
      {process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID ? (
        <ForgotPasswordForm defaultEmail={email || ""} next={next || "/"} />
      ) : (
        <p className="mt-8 text-sm text-red-800">
          Set <code>NEXT_PUBLIC_DESCOPE_PROJECT_ID</code>, then restart.
        </p>
      )}
    </div>
  );
}
