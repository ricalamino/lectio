import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { publishEnrich } from "@/lib/queue";
import { captureAddendums, captures } from "@lectio/core/db/schema";

const postSchema = z.object({
  body: z.string().min(1).max(100_000),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [capture] = await db()
    .select({ id: captures.id })
    .from(captures)
    .where(eq(captures.id, id))
    .limit(1);

  if (!capture) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db().insert(captureAddendums).values({
    captureId: id,
    body: parsed.data.body.trim(),
  });

  await db()
    .update(captures)
    .set({ status: "pending", updatedAt: new Date() })
    .where(eq(captures.id, id));

  await publishEnrich({ captureId: id });

  return NextResponse.json({ ok: true });
}
