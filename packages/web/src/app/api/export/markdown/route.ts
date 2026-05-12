import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
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
      capturedAt: captures.capturedAt,
      rawText: captures.rawText,
      sourceUrl: captures.sourceUrl,
      title: enrichments.title,
      summary: enrichments.summary,
      tags: enrichments.tags,
    })
    .from(captures)
    .leftJoin(enrichments, eq(enrichments.captureId, captures.id))
    .orderBy(desc(captures.capturedAt))
    .limit(MAX_EXPORT);

  const lines: string[] = ["# Lectio export", "", `_Generated: ${new Date().toISOString()}_`, ""];

  for (const r of rows) {
    const title = r.title?.trim() || "Untitled";
    lines.push(`## ${title}`);
    lines.push("");
    lines.push(`- **id:** \`${r.id}\``);
    lines.push(`- **kind:** ${r.kind}`);
    lines.push(`- **captured:** ${r.capturedAt.toISOString()}`);
    if (r.sourceUrl) lines.push(`- **source:** ${r.sourceUrl}`);
    if (Array.isArray(r.tags) && r.tags.length > 0) {
      lines.push(`- **tags:** ${r.tags.join(", ")}`);
    }
    lines.push("");
    if (r.summary) {
      lines.push(r.summary);
      lines.push("");
    }
    if (r.rawText) {
      lines.push("### Raw");
      lines.push("");
      lines.push(r.rawText);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  const body = lines.join("\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lectio-export.md"',
    },
  });
}
