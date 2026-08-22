import { NextResponse } from "next/server";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { canHost } from "@/lib/roles";
import { storePublicFile } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canHost(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 8MB." }, { status: 400 });
  }

  const ext = path.extname(file.name || "").toLowerCase() || ".png";
  const allowed = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: "Use a PNG, JPG, WEBP, or GIF." }, { status: 400 });
  }

  try {
    const url = await storePublicFile(
      `event-images/${Date.now()}${ext}`,
      Buffer.from(await file.arrayBuffer()),
      file.type || "image/png",
    );
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Could not store that image." }, { status: 500 });
  }
}
