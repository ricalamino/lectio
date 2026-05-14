import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures } from "@lectio/core/db/schema";
import { publishEnrich } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function POST() {
  const retried = await db()
    .update(captures)
    .set({ status: "pending", updatedAt: new Date() })
    .where(eq(captures.status, "failed"))
    .returning({ id: captures.id });

  if (retried.length === 0) {
    return NextResponse.json({ queued: 0 });
  }

  await Promise.all(retried.map((row) => publishEnrich({ captureId: row.id })));

  return NextResponse.json({ queued: retried.length });
}
