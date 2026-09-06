import { EventForm } from "@/components/EventForm";
import { createEventAction } from "@/app/actions/events";
import { getCurrentUser } from "@/lib/auth";
import { canHost } from "@/lib/roles";
import { redirect } from "next/navigation";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/events/new");
  if (!canHost(user)) redirect("/dashboard?error=host");
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-serif text-4xl">New event</h1>
      <div className="mt-8">
        <EventForm action={createEventAction} submitLabel="Create event" showVisibility error={error} />
      </div>
    </div>
  );
}
