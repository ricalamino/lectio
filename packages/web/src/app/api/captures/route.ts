import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { captures } from "@lectio/core/db/schema";
import { publishEnrich } from "@/lib/queue";
import { isObjectStorageConfigured, putCaptureObject, safeUploadFileName } from "@/lib/storage";

const createSchema = z
  .object({
    kind: z.enum(["text", "voice", "image", "link", "file"]),
    rawText: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    mediaKey: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((v) => Boolean(v.rawText?.trim()) || Boolean(v.mediaKey) || Boolean(v.sourceUrl), {
    message: "Provide rawText, mediaKey, or sourceUrl",
  });

export async function GET() {
  const rows = await db()
    .select()
    .from(captures)
    .orderBy(desc(captures.capturedAt))
    .limit(50);
  return NextResponse.json({ captures: rows });
}

async function insertCapture(values: {
  kind: "text" | "voice" | "image" | "link" | "file";
  rawText: string | null;
  sourceUrl: string | null;
  mediaKey: string | null;
  metadata: Record<string, unknown>;
}) {
  const [row] = await db()
    .insert(captures)
    .values({
      kind: values.kind,
      rawText: values.rawText,
      sourceUrl: values.sourceUrl,
      mediaKey: values.mediaKey,
      metadata: values.metadata,
    })
    .returning();
  if (!row) {
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
  await publishEnrich({ captureId: row.id });
  return NextResponse.json({ capture: row }, { status: 201 });
}

export async function POST(request: Request) {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const kindRaw = form.get("kind");
    const rawText = typeof form.get("rawText") === "string" ? (form.get("rawText") as string) : "";
    const sourceUrl = typeof form.get("sourceUrl") === "string" ? (form.get("sourceUrl") as string) : "";
    const file = form.get("file");
    const parsedKind = z.enum(["text", "voice", "image", "link", "file"]).safeParse(kindRaw);
    if (!parsedKind.success) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    const kind = parsedKind.data;
    if (!(file instanceof File) || file.size === 0) {
      const body = createSchema.safeParse({
        kind,
        rawText: rawText || undefined,
        sourceUrl: z.string().url().optional().safeParse(sourceUrl || undefined).data,
        metadata: {},
      });
      if (!body.success) {
        return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
      }
      return insertCapture({
        kind: body.data.kind,
        rawText: body.data.rawText?.trim() || null,
        sourceUrl: body.data.sourceUrl ?? null,
        mediaKey: body.data.mediaKey ?? null,
        metadata: body.data.metadata ?? {},
      });
    }

    const cfg = env();
    if (!isObjectStorageConfigured(cfg)) {
      return NextResponse.json({ error: "Object storage required for file upload" }, { status: 503 });
    }

    const [placeholder] = await db()
      .insert(captures)
      .values({
        kind,
        rawText: rawText.trim() || null,
        sourceUrl: z.string().url().optional().safeParse(sourceUrl || undefined).data ?? null,
        metadata: {
          mimeType: file.type && file.type.length > 0 ? file.type : "application/octet-stream",
        },
      })
      .returning();
    if (!placeholder) {
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = safeUploadFileName(file.name || "upload");
    const mediaKey = `captures/${placeholder.id}/${name}`;
    const contentType = file.type && file.type.length > 0 ? file.type : "application/octet-stream";
    await putCaptureObject(cfg, mediaKey, buffer, contentType);
    const [row] = await db()
      .update(captures)
      .set({ mediaKey, updatedAt: new Date() })
      .where(eq(captures.id, placeholder.id))
      .returning();
    if (!row) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    await publishEnrich({ captureId: row.id });
    return NextResponse.json({ capture: row }, { status: 201 });
  }

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  return insertCapture({
    kind: body.data.kind,
    rawText: body.data.rawText?.trim() || null,
    sourceUrl: body.data.sourceUrl ?? null,
    mediaKey: body.data.mediaKey ?? null,
    metadata: body.data.metadata ?? {},
  });
}
