import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-serif text-4xl">Choose a new password</h1>
      <p className="mt-3 text-sm text-[var(--mute)]">
        This page finishes the link we emailed you. After you save, you&apos;ll be signed in.
      </p>
      {process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID ? (
        <ResetPasswordForm />
      ) : (
        <p className="mt-8 text-sm text-red-800">
          Set <code>NEXT_PUBLIC_DESCOPE_PROJECT_ID</code>, then restart.
        </p>
      )}
    </div>
  );
}
