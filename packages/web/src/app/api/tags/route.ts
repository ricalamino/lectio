import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { enrichments } from "@lectio/core/db/schema";

export const dynamic = "force-dynamic";

/**
 * Distinct tag list with usage counts, sorted by count desc. Powers the
 * tag chips in /search and any future tag-driven UI. Capped at 50 so the
 * payload stays small; if the corpus grows past a few hundred tags we'll
 * want a server-side search/typeahead instead.
 */
export async function GET() {
  const rows = (await db().execute(sql`
    select tag, count(*)::int as count
    from ${enrichments}, jsonb_array_elements_text(${enrichments.tags}) as tag
    where jsonb_typeof(${enrichments.tags}) = 'array'
    group by tag
    order by count desc, tag asc
    limit 50
  `)) as unknown as Array<{ tag: string; count: number }>;

  return NextResponse.json({ tags: rows });
}
