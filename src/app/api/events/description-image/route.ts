import { NextResponse } from "next/server";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { canHost } from "@/lib/roles";
import { storePrivateFile } from "@/lib/storage";

function extFromFile(file: File) {
  const fromName = path.extname(file.name || "").toLowerCase();
  if (fromName) return fromName;
  if (file.type === "image/png") return ".png";
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/webp") return ".webp";
  if (file.type === "image/gif") return ".gif";
  return ".png";
}

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

  const ext = extFromFile(file);
  const allowed = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: "Use a PNG, JPG, WEBP, or GIF." }, { status: 400 });
  }

  try {
    const stored = await storePrivateFile(
      `event-images/${Date.now()}${ext}`,
      Buffer.from(await file.arrayBuffer()),
      file.type || "image/png",
    );
    const url = `/api/public-media?key=${encodeURIComponent(stored)}`;
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not store that image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
