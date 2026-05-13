import Link from "next/link";
import { and, count, desc, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures, enrichments } from "@lectio/core/db/schema";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface SearchParams {
  cursor?: string;
}

interface Cursor {
  capturedAt: string;
  id: string;
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
    if (typeof parsed.capturedAt !== "string" || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const cursor = decodeCursor(searchParams?.cursor);

  // Keyset pagination: (capturedAt, id) strictly less than the cursor. Stable
  // even when many captures share the same capturedAt (mass imports).
  const whereClause = cursor
    ? or(
        lt(captures.capturedAt, new Date(cursor.capturedAt)),
        and(
          sql`${captures.capturedAt} = ${new Date(cursor.capturedAt)}`,
          lt(captures.id, cursor.id),
        ),
      )
    : undefined;

  const [rows, totalRow] = await Promise.all([
    db()
      .select({
        id: captures.id,
        kind: captures.kind,
        status: captures.status,
        rawText: captures.rawText,
        capturedAt: captures.capturedAt,
        title: enrichments.title,
        summary: enrichments.summary,
        tags: enrichments.tags,
      })
      .from(captures)
      .leftJoin(enrichments, eq(enrichments.captureId, captures.id))
      .where(whereClause)
      .orderBy(desc(captures.capturedAt), desc(captures.id))
      .limit(PAGE_SIZE + 1),
    db().select({ value: count() }).from(captures),
  ]);

  const hasNext = rows.length > PAGE_SIZE;
  const visible = hasNext ? rows.slice(0, PAGE_SIZE) : rows;
  const total = totalRow[0]?.value ?? 0;
  const last = visible[visible.length - 1];
  const nextCursor =
    hasNext && last
      ? encodeCursor({ capturedAt: last.capturedAt.toISOString(), id: last.id })
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <span className="text-muted-foreground text-xs">
          {total} {total === 1 ? "capture" : "captures"} total
        </span>
      </div>
      {visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing yet. Start capturing.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {visible.map((c) => (
            <li key={c.id} className="px-4 py-3 text-sm">
              <Link href={`/inbox/${c.id}`} className="block hover:bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium leading-snug">
                    {c.title ?? c.rawText?.slice(0, 80) ?? "Untitled capture"}
                  </span>
                  <span
                    className={`shrink-0 text-xs ${
                      c.status === "failed"
                        ? "text-destructive"
                        : c.status === "pending" || c.status === "enriching"
                          ? "text-muted-foreground/60"
                          : "text-muted-foreground"
                    }`}
                  >
                    {c.status === "enriched" ? c.kind : c.status}
                  </span>
                </div>
                {c.summary ? (
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{c.summary}</p>
                ) : c.rawText && !c.title ? null : c.rawText ? (
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{c.rawText}</p>
                ) : null}
                {Array.isArray(c.tags) && c.tags.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(c.tags as string[]).slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between text-sm">
        {cursor ? (
          <Link href="/inbox" className="text-muted-foreground hover:text-foreground underline">
            ← Newest
          </Link>
        ) : (
          <span />
        )}
        {nextCursor ? (
          <Link
            href={`/inbox?cursor=${nextCursor}`}
            className="text-muted-foreground hover:text-foreground underline"
          >
            Older →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
