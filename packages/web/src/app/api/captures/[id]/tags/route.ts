import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { enrichments } from "@lectio/core/db/schema";

const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .transform((s) => s.toLowerCase());

const patchSchema = z.object({
  add: z.array(tagSchema).optional(),
  remove: z.array(tagSchema).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  const body = patchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const add = body.data.add ?? [];
  const remove = body.data.remove ?? [];
  if (add.length === 0 && remove.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [row] = await db()
    .select({ tags: enrichments.tags })
    .from(enrichments)
    .where(and(eq(enrichments.captureId, id), eq(enrichments.isCurrent, true)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Enrichment not found" }, { status: 404 });
  }

  const removeSet = new Set(remove);
  const next = (row.tags ?? []).filter((t) => !removeSet.has(t));
  for (const t of add) if (!next.includes(t)) next.push(t);

  await db()
    .update(enrichments)
    .set({ tags: sql`${JSON.stringify(next)}::jsonb` })
    .where(and(eq(enrichments.captureId, id), eq(enrichments.isCurrent, true)));

  return NextResponse.json({ tags: next });
}
