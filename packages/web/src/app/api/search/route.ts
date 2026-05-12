import { NextResponse } from "next/server";
import { desc, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures } from "@lectio/core/db/schema";

// MVP: lexical-only over raw text. The semantic + LLM rerank path lives in the
// worker; this route is what the UI hits for instant feedback while the
// semantic pipeline is still being built out.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ hits: [] });
  }
  const pattern = `%${q}%`;
  const rows = await db()
    .select({ id: captures.id, rawText: captures.rawText, kind: captures.kind })
    .from(captures)
    .where(or(ilike(captures.rawText, pattern), ilike(captures.sourceUrl, pattern)))
    .orderBy(desc(captures.capturedAt))
    .limit(20);
  return NextResponse.json({ hits: rows });
}
