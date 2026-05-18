import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { pins } from "@lectio/core/db/schema";

export const dynamic = "force-dynamic";

const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("capture"), captureId: z.string().uuid() }),
  z.object({ kind: z.literal("tag"), tag: z.string().trim().min(1).max(100) }),
  z.object({ kind: z.literal("search"), query: z.string().trim().min(1).max(500) }),
]);

// Delete a pin by its target (capture id / tag / query) instead of pin id.
// Lets toggle buttons unpin without having to first fetch the pin row.
export async function DELETE(request: Request) {
  const parsed = targetSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const where =
    data.kind === "capture"
      ? and(eq(pins.kind, "capture"), eq(pins.captureId, data.captureId))
      : data.kind === "tag"
      ? and(eq(pins.kind, "tag"), eq(pins.tag, data.tag.replace(/^#+/, "")))
      : and(eq(pins.kind, "search"), eq(pins.searchQuery, data.query));

  await db().delete(pins).where(where);
  return NextResponse.json({ ok: true });
}
