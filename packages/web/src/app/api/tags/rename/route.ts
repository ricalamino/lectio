import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { enrichments } from "@lectio/core/db/schema";

const bodySchema = z.object({
  from: z.string().trim().min(1).max(50).transform((s) => s.toLowerCase()),
  to: z.string().trim().min(1).max(50).transform((s) => s.toLowerCase()),
});

/**
 * Global tag rename. Updates every current enrichment row whose `tags`
 * array contains `from`: removes `from` and appends `to` if missing,
 * preserving distinctness. No-op rows are skipped via the WHERE clause.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { from, to } = parsed.data;
  if (from === to) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const result = await db().execute(sql`
    update ${enrichments}
    set tags = (
      select coalesce(jsonb_agg(distinct value), '[]'::jsonb)
      from jsonb_array_elements_text(
        case
          when ${enrichments.tags} @> ${JSON.stringify([to])}::jsonb
            then ${enrichments.tags} - ${from}
          else (${enrichments.tags} - ${from}) || ${JSON.stringify([to])}::jsonb
        end
      ) as value
    )
    where ${enrichments.isCurrent}
      and ${enrichments.tags} @> ${JSON.stringify([from])}::jsonb
  `);

  const updated = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  return NextResponse.json({ ok: true, updated });
}
