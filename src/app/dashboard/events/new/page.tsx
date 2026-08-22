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
      {error ? (
        <p className="mt-3 text-sm text-red-800">
          {error === "price"
            ? "Paid events need a price of at least $1."
            : "Fill title, description, venue, and start time."}
        </p>
      ) : null}
      <form action={createEventAction} className="mt-8 grid gap-4">
        <div>
          <label className="label">Title</label>
          <input className="field" name="title" required />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="field min-h-32" name="description" required />
        </div>
        <div>
          <label className="label">Venue</label>
          <input className="field" name="venue" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Starts</label>
            <input className="field" type="datetime-local" name="startsAt" required />
          </div>
          <div>
            <label className="label">Ends (optional)</label>
            <input className="field" type="datetime-local" name="endsAt" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isNetworking" defaultChecked />
          Who&apos;s Going: confirmed guests can see each other
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPaid" />
          Paid event (guests upload a receipt; you mark them paid)
        </label>
        <div>
          <label className="label">Price (USD)</label>
          <input className="field" type="number" name="price" min="0" step="0.01" defaultValue="45" />
        </div>
        <div>
          <label className="label">Payment instructions</label>
          <textarea
            className="field min-h-24"
            name="paymentInstructions"
            placeholder="Bank details, Venmo handle, what to write in the transfer memo…"
          />
        </div>
        <div>
          <label className="label">Payment image (QR code, optional)</label>
          <input className="field" type="file" name="paymentImage" accept="image/*" />
        </div>
        <button className="btn-gold w-fit" type="submit">
          Publish event
        </button>
      </form>
    </div>
  );
}
