import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getChannelBySlug } from "@/lib/channels";
import { prisma } from "@/lib/prisma";
import { canManageEvent } from "@/lib/roles";
import { readPrivateFile } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const channel = await getChannelBySlug(slug);
  if (!channel?.paymentImagePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signup = await prisma.registration.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId: user.id } },
  });
  if (!signup && !canManageEvent(user, channel.event.organizerId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const file = await readPrivateFile(channel.paymentImagePath);
  if (!file) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
