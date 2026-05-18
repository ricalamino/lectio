import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { captures, enrichments } from "@lectio/core/db/schema";

const MAX_EXPORT = 500;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db()
    .select({
      id: captures.id,
      kind: captures.kind,
      status: captures.status,
      capturedAt: captures.capturedAt,
      rawText: captures.rawText,
      sourceUrl: captures.sourceUrl,
      title: enrichments.title,
      summary: enrichments.summary,
      tags: enrichments.tags,
      entities: enrichments.entities,
      contentType: enrichments.contentType,
      suggestedAction: enrichments.suggestedAction,
    })
    .from(captures)
    .leftJoin(
      enrichments,
      and(eq(enrichments.captureId, captures.id), eq(enrichments.isCurrent, true)),
    )
    .orderBy(desc(captures.capturedAt))
    .limit(MAX_EXPORT);

  const body = JSON.stringify({ exported_at: new Date().toISOString(), captures: rows }, null, 2);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lectio-export.json"',
    },
  });
}
