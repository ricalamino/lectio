import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { captures } from "@lectio/core/db/schema";
import { publishEnrich } from "@/lib/queue";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  const [deleted] = await db()
    .delete(captures)
    .where(eq(captures.id, id))
    .returning({ id: captures.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

const patchSchema = z.object({
  rawText: z.string().min(1).max(100_000),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  const body = patchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const [updated] = await db()
    .update(captures)
    .set({ rawText: body.data.rawText, status: "pending", updatedAt: new Date() })
    .where(eq(captures.id, id))
    .returning({ id: captures.id });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await publishEnrich({ captureId: id });

  return NextResponse.json({ ok: true });
}
