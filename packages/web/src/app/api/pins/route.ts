import { NextResponse } from "next/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { captures, enrichments, pins } from "@lectio/core/db/schema";

export const dynamic = "force-dynamic";

const captureSchema = z.object({
  kind: z.literal("capture"),
  captureId: z.string().uuid(),
});

const tagSchema = z.object({
  kind: z.literal("tag"),
  tag: z.string().trim().min(1).max(100),
});

const searchSchema = z.object({
  kind: z.literal("search"),
  query: z.string().trim().min(1).max(500),
  label: z.string().trim().min(1).max(100).optional(),
});

const createSchema = z.discriminatedUnion("kind", [
  captureSchema,
  tagSchema,
  searchSchema,
]);

export async function GET() {
  const database = db();
  const rows = await database
    .select({
      id: pins.id,
      kind: pins.kind,
      captureId: pins.captureId,
      tag: pins.tag,
      searchQuery: pins.searchQuery,
      searchLabel: pins.searchLabel,
      position: pins.position,
      createdAt: pins.createdAt,
      captureTitle: enrichments.title,
      captureSummary: enrichments.summary,
      captureRawText: captures.rawText,
      captureKind: captures.kind,
    })
    .from(pins)
    .leftJoin(captures, eq(captures.id, pins.captureId))
    .leftJoin(
      enrichments,
      and(eq(enrichments.captureId, captures.id), eq(enrichments.isCurrent, true)),
    )
    .orderBy(asc(pins.position), desc(pins.createdAt));

  return NextResponse.json({ pins: rows });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const database = db();
  const [{ next } = { next: 0 }] = await database
    .select({ next: sql<number>`coalesce(max(${pins.position}), -1) + 1` })
    .from(pins);

  const data = parsed.data;
  const values =
    data.kind === "capture"
      ? { kind: "capture" as const, captureId: data.captureId, position: Number(next) }
      : data.kind === "tag"
      ? { kind: "tag" as const, tag: data.tag.replace(/^#+/, ""), position: Number(next) }
      : {
          kind: "search" as const,
          searchQuery: data.query,
          searchLabel: data.label ?? null,
          position: Number(next),
        };

  if (values.kind === "tag" && !values.tag) {
    return NextResponse.json({ error: "Tag is empty" }, { status: 400 });
  }

  try {
    const [row] = await database.insert(pins).values(values).returning();
    return NextResponse.json({ pin: row }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("pins_capture_unique")) {
      return NextResponse.json({ error: "Capture already pinned" }, { status: 409 });
    }
    if (msg.includes("pins_tag_unique")) {
      return NextResponse.json({ error: "Tag already pinned" }, { status: 409 });
    }
    if (msg.includes("pins_search_unique")) {
      return NextResponse.json({ error: "Search already pinned" }, { status: 409 });
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
  await db().delete(pins).where(eq(pins.id, parsed.data.id));
  return NextResponse.json({ ok: true });
}
