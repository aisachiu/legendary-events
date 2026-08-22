import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

export async function storeEvidence(
  filename: string,
  bytes: Buffer,
  contentType: string,
) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`evidence/${filename}`, bytes, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/${filename}`;
}
