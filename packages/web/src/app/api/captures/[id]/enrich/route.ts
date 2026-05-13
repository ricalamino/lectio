import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { publishEnrich } from "@/lib/queue";
import { captures } from "@lectio/core/db/schema";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  const [capture] = await db()
    .select({ id: captures.id, status: captures.status })
    .from(captures)
    .where(eq(captures.id, id))
    .limit(1);

  if (!capture) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (capture.status === "enriching") {
    return NextResponse.json({ error: "Already enriching" }, { status: 409 });
  }

  await db()
    .update(captures)
    .set({ status: "pending", updatedAt: new Date() })
    .where(eq(captures.id, id));

  await publishEnrich({ captureId: id });

  return NextResponse.json({ ok: true });
}
