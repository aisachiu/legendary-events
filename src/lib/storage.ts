import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

const LOCAL_DIR = path.join(process.cwd(), "uploads-private");

function blobReady() {
  return Boolean(
    process.env.BLOB_STORE_ID ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.BLOB_READ_WRITE_TOKEN,
  );
}

export async function storePrivateFile(
  pathname: string,
  bytes: Buffer,
  contentType: string,
) {
  if (blobReady()) {
    const blob = await put(pathname, bytes, {
      access: "private",
      addRandomSuffix: true,
      allowOverwrite: true,
      contentType,
    });
    return blob.url;
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  const safe = pathname.replace(/[^a-zA-Z0-9._/-]/g, "_");
  const unique = `${Date.now()}-${path.basename(safe)}`;
  const full = path.join(LOCAL_DIR, unique);
  await writeFile(full, bytes);
  return `local:${unique}`;
}

export async function readPrivateFile(stored: string): Promise<{
  body: Buffer;
  contentType: string;
} | null> {
  if (stored.startsWith("local:")) {
    const full = path.join(LOCAL_DIR, stored.slice("local:".length));
    const body = await readFile(full);
    return { body, contentType: guessType(stored) };
  }

  if (!blobReady()) return null;

  const result = await get(stored, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const body = await streamToBuffer(result.stream);
  return {
    body,
    contentType: result.blob.contentType || guessType(stored),
  };
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function guessType(name: string) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export function eventBlurb(description: string, summary?: string | null) {
  if (summary?.trim()) return summary.trim();
  const line = description.trim().split("\n").find((l) => l.trim());
  return line?.trim() ?? "";
}

export async function storeImageFromForm(file: File | null, folder: string) {
  if (!file || file.size === 0) return null;
  if (file.size > 8 * 1024 * 1024) return null;
  const ext = path.extname(file.name || "").toLowerCase() || ".png";
  const allowed = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
  if (!allowed.includes(ext)) return null;
  return storePrivateFile(
    `${folder}/${Date.now()}${ext}`,
    Buffer.from(await file.arrayBuffer()),
    file.type || "image/png",
  );
}
