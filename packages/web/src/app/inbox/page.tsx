import Link from "next/link";
import { and, count, desc, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures } from "@lectio/core/db/schema";

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
      .select()
      .from(captures)
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
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.kind}</span>
                  <span className="text-muted-foreground text-xs">{c.status}</span>
                </div>
                {c.rawText ? (
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{c.rawText}</p>
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
