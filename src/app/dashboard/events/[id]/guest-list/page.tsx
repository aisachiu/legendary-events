import { redirect } from "next/navigation";

export default async function GuestListRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ amounts?: string }>;
}) {
  const { id } = await params;
  const { amounts } = await searchParams;
  const q = amounts === "1" ? "?amounts=1" : "";
  redirect(`/dashboard/events/${id}${q}`);
}
