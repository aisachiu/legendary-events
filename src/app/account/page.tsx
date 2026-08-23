import { redirect } from "next/navigation";
import { AccountPanel } from "@/components/AccountPanel";
import { getCurrentUser } from "@/lib/auth";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; next?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const { welcome, next } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-serif text-4xl">{welcome === "1" ? "One more thing" : "Account"}</h1>
      {welcome === "1" ? null : (
        <p className="mt-3 text-sm text-[var(--mute)]">
          Your name shows on sign-out and on events you host. Link Google, a phone, or email — phone
          and email use magic links.
        </p>
      )}
      <AccountPanel name={user.name} welcome={welcome === "1"} next={next || "/"} />
    </div>
  );
}
