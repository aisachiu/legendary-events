import { NextResponse } from "next/server";
import { readPrivateFile } from "@/lib/storage";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key.includes("event-images")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const file = await readPrivateFile(key);
  if (!file) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
