import Link from "next/link";
import { and, asc, desc, eq, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures, enrichments, inboxTabs } from "@lectio/core/db/schema";
import {
  getCaptureStatusCounts,
  getTagCaptureCounts,
} from "@/lib/capture-status-counts";
import { InboxFilterTabs } from "@/components/inbox-filter-tabs";
import { RetryAllFailedEnrichment } from "@/components/retry-all-failed-enrichment";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type StatusFilter = "all" | "processing" | "failed";

interface SearchParams {
  cursor?: string;
  filter?: string;
  tab?: string;
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

function parseStatusFilter(raw: string | undefined): StatusFilter {
  if (raw === "processing" || raw === "failed") return raw;
  return "all";
}

function StatusPill({ status, kind }: { status: string; kind: string }) {
  if (status === "failed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        Failed
      </span>
    );
  }
  if (status === "pending" || status === "enriching") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        {status === "enriching" ? "Enriching" : "Queued"}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
      {kind}
    </span>
  );
}

function statusClause(filter: StatusFilter): SQL | undefined {
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
  const statusFilter = parseStatusFilter(searchParams?.filter);
  const tab = searchParams?.tab?.trim() || null;

  const cursorClause: SQL | undefined = cursor
    ? or(
        lt(captures.capturedAt, new Date(cursor.capturedAt)),
        and(
          sql`${captures.capturedAt} = ${new Date(cursor.capturedAt)}`,
          lt(captures.id, cursor.id),
        ),
      )
    : undefined;

  const tagClause: SQL | undefined = tab
    ? sql`${enrichments.tags} ? ${tab}`
    : undefined;

  const status = statusClause(statusFilter);
  const whereParts = [cursorClause, status, tagClause].filter(
    (c): c is SQL => Boolean(c),
  );
  const whereClause =
    whereParts.length === 0
      ? undefined
      : whereParts.length === 1
      ? whereParts[0]
      : and(...whereParts);

  const database = db();
  const [rows, statusCounts, tabs] = await Promise.all([
    database
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
    getCaptureStatusCounts(database),
    database
      .select()
      .from(inboxTabs)
      .orderBy(asc(inboxTabs.position), asc(inboxTabs.createdAt)),
  ]);

  const tagCounts = await getTagCaptureCounts(
    database,
    tabs.map((t) => t.tag),
  );

  const hasNext = rows.length > PAGE_SIZE;
  const visible = hasNext ? rows.slice(0, PAGE_SIZE) : rows;
  const last = visible[visible.length - 1];
  const nextCursor =
    hasNext && last
      ? encodeCursor({ capturedAt: last.capturedAt.toISOString(), id: last.id })
      : null;

  const baseQuery = new URLSearchParams();
  if (tab) baseQuery.set("tab", tab);
  if (statusFilter !== "all") baseQuery.set("filter", statusFilter);
  const baseHref = baseQuery.toString() ? `/inbox?${baseQuery.toString()}` : "/inbox";
  const olderQuery = new URLSearchParams(baseQuery);
  if (nextCursor) olderQuery.set("cursor", nextCursor);

  const emptyState = (() => {
    if (statusFilter === "failed") {
      return {
        title: "Nothing failed.",
        body: "All captures enriched successfully.",
      };
    }
    if (statusFilter === "processing") {
      return {
        title: "All caught up.",
        body: "No captures are being processed right now.",
      };
    }
    if (tab) {
      return {
        title: `No captures tagged #${tab}.`,
        body: "As you capture more, items matching this tag will appear here.",
      };
    }
    return {
      title: "Your inbox is empty.",
      body: null as null | string,
    };
  })();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>

      <InboxFilterTabs
        activeStatus={statusFilter}
        activeTab={tab}
        initialCounts={statusCounts}
        initialTabs={tabs.map((t) => ({
          id: t.id,
          tag: t.tag,
          label: t.label,
          count: tagCounts[t.tag] ?? 0,
        }))}
      />

      {statusFilter === "failed" ? (
        <div className="flex justify-end">
          <RetryAllFailedEnrichment failedCount={statusCounts.failed} />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium">{emptyState.title}</p>
          {emptyState.body ? (
            <p className="mt-1 text-sm text-muted-foreground">{emptyState.body}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Paste a link, jot a thought, or share from any app —{" "}
              <Link href="/capture" className="underline underline-offset-4 hover:text-foreground">
                start capturing
              </Link>
              .
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {visible.map((c) => (
            <li key={c.id} className="px-4 py-3 text-sm">
              <Link href={`/inbox/${c.id}`} className="block hover:bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium leading-snug">
                    {c.title ?? c.rawText?.slice(0, 80) ?? "Untitled capture"}
                  </span>
                  <StatusPill status={c.status} kind={c.kind} />
                </div>
                {c.summary ? (
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{c.summary}</p>
                ) : c.rawText && !c.title ? null : c.rawText ? (
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{c.rawText}</p>
                ) : null}
                {Array.isArray(c.tags) && c.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(c.tags as string[]).slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        <span className="text-muted-foreground/50">#</span>
                        {t}
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
          <Link href={baseHref} className="text-muted-foreground hover:text-foreground underline">
            ← Newest
          </Link>
        ) : (
          <span />
        )}
        {nextCursor ? (
          <Link
            href={`/inbox?${olderQuery.toString()}`}
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
