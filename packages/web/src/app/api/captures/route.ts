import { NextResponse } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures } from "@lectio/core/db/schema";
import { publishEnrich } from "@/lib/queue";

const createSchema = z.object({
  kind: z.enum(["text", "voice", "image", "link", "file"]),
  rawText: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  mediaKey: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET() {
  const rows = await db()
    .select()
    .from(captures)
    .orderBy(desc(captures.capturedAt))
    .limit(50);
  return NextResponse.json({ captures: rows });
}

export async function POST(request: Request) {
  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const [row] = await db()
    .insert(captures)
    .values({
      kind: body.data.kind,
      rawText: body.data.rawText,
      sourceUrl: body.data.sourceUrl,
      mediaKey: body.data.mediaKey,
      metadata: body.data.metadata ?? {},
    })
    .returning();
  if (!row) {
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
  await publishEnrich({ captureId: row.id });
  return NextResponse.json({ capture: row }, { status: 201 });
}
