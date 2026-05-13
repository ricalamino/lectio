import { NextResponse } from "next/server";
import { count, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures } from "@lectio/core/db/schema";

export async function GET() {
  const [pending, enriching, failed] = await Promise.all([
    db().select({ value: count() }).from(captures).where(eq(captures.status, "pending")),
    db().select({ value: count() }).from(captures).where(eq(captures.status, "enriching")),
    db().select({ value: count() }).from(captures).where(eq(captures.status, "failed")),
  ]);

  return NextResponse.json({
    pending: pending[0]?.value ?? 0,
    enriching: enriching[0]?.value ?? 0,
    failed: failed[0]?.value ?? 0,
  });
}
