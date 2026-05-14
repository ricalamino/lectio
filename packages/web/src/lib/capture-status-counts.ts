import { count, sql } from "drizzle-orm";
import type { Database } from "@lectio/core/db";
import { captures } from "@lectio/core/db/schema";

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
