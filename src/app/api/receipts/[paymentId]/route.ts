import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageEvent } from "@/lib/roles";
import { readPrivateFile } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paymentId } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { registration: { include: { event: true } } },
  });
  if (!payment?.evidencePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canManageEvent(user, payment.registration.event.organizerId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const file = await readPrivateFile(payment.evidencePath);
  if (!file) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
