import Link from "next/link";
import { and, desc, eq, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures, enrichments } from "@lectio/core/db/schema";
import { getCaptureStatusCounts } from "@/lib/capture-status-counts";
import { InboxFilterTabs, type InboxFilterKind } from "@/components/inbox-filter-tabs";
import { RetryAllFailedEnrichment } from "@/components/retry-all-failed-enrichment";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type FilterKind = InboxFilterKind;

interface SearchParams {
  cursor?: string;
  filter?: string;
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

function parseFilter(raw: string | undefined): FilterKind {
  if (raw === "processing" || raw === "failed") return raw;
  return "all";
}

function filterClause(filter: FilterKind): SQL | undefined {
  if (filter === "processing") {
    return or(eq(captures.status, "pending"), eq(captures.status, "enriching"));
  }
  if (filter === "failed") {
    return eq(captures.status, "failed");
  }
  return undefined;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const cursor = decodeCursor(searchParams?.cursor);
  const filter = parseFilter(searchParams?.filter);

  const cursorClause: SQL | undefined = cursor
    ? or(
        lt(captures.capturedAt, new Date(cursor.capturedAt)),
        and(
          sql`${captures.capturedAt} = ${new Date(cursor.capturedAt)}`,
          lt(captures.id, cursor.id),
        ),
      )
    : undefined;

  const statusFilter = filterClause(filter);
  const whereClause =
    cursorClause && statusFilter
      ? and(cursorClause, statusFilter)
      : cursorClause ?? statusFilter;

  const [rows, statusCounts] = await Promise.all([
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
    getCaptureStatusCounts(db()),
  ]);

  const hasNext = rows.length > PAGE_SIZE;
  const visible = hasNext ? rows.slice(0, PAGE_SIZE) : rows;
  const last = visible[visible.length - 1];
  const nextCursor =
    hasNext && last
      ? encodeCursor({ capturedAt: last.capturedAt.toISOString(), id: last.id })
      : null;


  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>

      <InboxFilterTabs activeFilter={filter} initialCounts={statusCounts} />

      {filter === "failed" ? (
        <div className="flex justify-end">
          <RetryAllFailedEnrichment failedCount={statusCounts.failed} />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {filter === "failed"
            ? "No failed captures."
            : filter === "processing"
              ? "No captures being processed."
              : "Nothing yet. Start capturing."}
        </p>
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
          <Link
            href={filter === "all" ? "/inbox" : `/inbox?filter=${filter}`}
            className="text-muted-foreground hover:text-foreground underline"
          >
            ← Newest
          </Link>
        ) : (
          <span />
        )}
        {nextCursor ? (
          <Link
            href={`/inbox?cursor=${nextCursor}${filter !== "all" ? `&filter=${filter}` : ""}`}
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
