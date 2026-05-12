import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { captures } from "@lectio/core/db/schema";
import { publishEnrich } from "@/lib/queue";
import { isObjectStorageConfigured, putCaptureObject, safeUploadFileName } from "@/lib/storage";

const MAX_SHARE_FILE_BYTES = 15 * 1024 * 1024;

// PWA share target. Receives whatever the OS sends — title/text/url and
// optionally a file — and turns it into a capture. The shape mirrors
// manifest.webmanifest's share_target params.
export async function POST(request: Request) {
  const form = await request.formData();
  const title = form.get("title");
  const text = form.get("text");
  const url = form.get("url");
  const file = form.get("file");

  const rawText = [title, text].filter(Boolean).join("\n\n").trim() || null;
  const sourceUrl = typeof url === "string" && url.length > 0 ? url : null;

  let kind: "text" | "link" | "image" | "file" = "text";
  if (file instanceof File && file.size > 0) {
    kind = file.type.startsWith("image/") ? "image" : "file";
  } else if (sourceUrl) {
    kind = "link";
  }

  const [row] = await db()
    .insert(captures)
    .values({
      kind,
      rawText,
      sourceUrl,
      metadata:
        file instanceof File && file.size > 0
          ? { mimeType: file.type && file.type.length > 0 ? file.type : "application/octet-stream" }
          : {},
    })
    .returning();
  if (!row) {
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  const cfg = env();
  if (
    file instanceof File &&
    file.size > 0 &&
    file.size <= MAX_SHARE_FILE_BYTES &&
    isObjectStorageConfigured(cfg)
  ) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const name = safeUploadFileName(file.name || "upload");
    const mediaKey = `captures/${row.id}/${name}`;
    const contentType = file.type && file.type.length > 0 ? file.type : "application/octet-stream";
    await putCaptureObject(cfg, mediaKey, buffer, contentType);
    await db()
      .update(captures)
      .set({ mediaKey, updatedAt: new Date() })
      .where(eq(captures.id, row.id));
  }

  await publishEnrich({ captureId: row.id });
  return NextResponse.redirect(new URL("/inbox", request.url), 303);
}
