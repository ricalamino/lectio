import { count, sql } from "drizzle-orm";
import type { Database } from "@lectio/core/db";
import { captures, enrichments } from "@lectio/core/db/schema";

export interface CaptureStatusCounts {
  total: number;
  pending: number;
  enriching: number;
  processing: number;
  failed: number;
}

function asNumber(value: number | string | bigint | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function getCaptureStatusCounts(db: Database): Promise<CaptureStatusCounts> {
  const [row] = await db
    .select({
      total: count(),
      pending: sql<number>`count(*) filter (where ${captures.status} = 'pending')`,
      enriching: sql<number>`count(*) filter (where ${captures.status} = 'enriching')`,
      failed: sql<number>`count(*) filter (where ${captures.status} = 'failed')`,
    })
    .from(captures);

  const pending = asNumber(row?.pending);
  const enriching = asNumber(row?.enriching);

  return {
    total: asNumber(row?.total),
    pending,
    enriching,
    processing: pending + enriching,
    failed: asNumber(row?.failed),
  };
}

/**
 * Counts enriched captures matching each of the requested tags. Used by the
 * inbox to show how many items live behind each user-pinned tag tab.
 */
export async function getTagCaptureCounts(
  db: Database,
  tags: string[],
): Promise<Record<string, number>> {
  if (tags.length === 0) return {};
  // Filter the wanted tags via a jsonb subquery — using `= any($1::text[])`
  // made postgres-js serialize the JS array as a PG text[] literal, which
  // chokes on payloads that happen to look like array elements (e.g. "edu7").
  const tagsJson = JSON.stringify(tags);
  const rows = (await db.execute(sql`
    select tag, count(*)::int as count
    from ${enrichments}, jsonb_array_elements_text(${enrichments.tags}) as tag
    where ${enrichments.isCurrent}
      and jsonb_typeof(${enrichments.tags}) = 'array'
      and tag in (select jsonb_array_elements_text(${tagsJson}::jsonb))
    group by tag
  `)) as unknown as Array<{ tag: string; count: number }>;

  const map: Record<string, number> = {};
  for (const t of tags) map[t] = 0;
  for (const r of rows) map[r.tag] = asNumber(r.count);
  return map;
}
