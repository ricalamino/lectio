import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { inboxTabs } from "@lectio/core/db/schema";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  tag: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(100).optional(),
});

export async function GET() {
  const rows = await db()
    .select()
    .from(inboxTabs)
    .orderBy(asc(inboxTabs.position), asc(inboxTabs.createdAt));
  return NextResponse.json({ tabs: rows });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const tag = parsed.data.tag.replace(/^#+/, "");
  if (!tag) {
    return NextResponse.json({ error: "Tag is empty" }, { status: 400 });
  }

  const [{ next } = { next: 0 }] = await db()
    .select({ next: sql<number>`coalesce(max(${inboxTabs.position}), -1) + 1` })
    .from(inboxTabs);

  try {
    const [row] = await db()
      .insert(inboxTabs)
      .values({ tag, label: parsed.data.label ?? null, position: Number(next) })
      .returning();
    return NextResponse.json({ tab: row }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("inbox_tabs_tag_unique")) {
      return NextResponse.json({ error: "Tag already pinned" }, { status: 409 });
    }
    throw err;
  }
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const idParam = url.searchParams.get("id");
  const parsed = deleteSchema.safeParse({ id: idParam });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await db().delete(inboxTabs).where(eq(inboxTabs.id, parsed.data.id));
  return NextResponse.json({ ok: true });
}
