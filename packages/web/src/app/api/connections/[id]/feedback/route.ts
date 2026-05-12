import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  connections,
  feedback,
  rejectedConnectionEdges,
} from "@lectio/core/db/schema";

const bodySchema = z.object({
  kind: z.enum(["useful", "noise", "wrong"]),
});

export async function POST(
  request: Request,
  ctx: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = bodySchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
  }

  const { id } = ctx.params;
  const [conn] = await db()
    .select()
    .from(connections)
    .where(eq(connections.id, id))
    .limit(1);

  if (!conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const { kind } = parsedBody.data;

  if (kind === "useful") {
    await db().insert(feedback).values({
      captureId: conn.fromCaptureId,
      connectionId: conn.id,
      kind: "useful",
    });
    return NextResponse.json({ ok: true });
  }

  await db().transaction(async (tx) => {
    await tx
      .insert(rejectedConnectionEdges)
      .values({
        fromCaptureId: conn.fromCaptureId,
        toCaptureId: conn.toCaptureId,
      })
      .onConflictDoNothing({
        target: [rejectedConnectionEdges.fromCaptureId, rejectedConnectionEdges.toCaptureId],
      });
    await tx.insert(feedback).values({
      captureId: conn.fromCaptureId,
      connectionId: conn.id,
      kind,
    });
    await tx.delete(connections).where(eq(connections.id, conn.id));
  });

  return NextResponse.json({ ok: true });
}
