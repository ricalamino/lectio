import Link from "next/link";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures, enrichments } from "@lectio/core/db/schema";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface SearchParams {
  month?: string;
  day?: string;
}

interface DayRow {
  day: string;
  count: number;
}

interface CaptureRow {
  id: string;
  kind: string;
  status: string;
  title: string | null;
  summary: string | null;
  rawText: string | null;
  tags: string[] | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Today in UTC as YYYY-MM-DD. Used both as the default month and to
 *  highlight "today" in the grid. */
function todayIso(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Parses `YYYY-MM` (month nav) or `YYYY-MM-DD` (day pick) into a normalized
 *  pair of `monthStart` (first day of the month, UTC) and `selectedDay`
 *  (the actual day to list, defaults to today when in current month). */
function parseMonthAndDay(params: SearchParams): {
  monthStart: Date;
  selectedDay: string;
  monthKey: string;
} {
  const today = todayIso();
  const dayMatch = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : null;
  const monthMatch = params.month && /^\d{4}-\d{2}$/.test(params.month)
    ? params.month
    : dayMatch
      ? dayMatch.slice(0, 7)
      : today.slice(0, 7);

  const [y, m] = monthMatch.split("-").map((n) => parseInt(n, 10)) as [number, number];
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthKey = `${y}-${pad(m)}`;

  let selectedDay = dayMatch ?? "";
  if (!selectedDay) {
    selectedDay = monthKey === today.slice(0, 7) ? today : `${monthKey}-01`;
  }
  // If the requested day falls outside the requested month, snap to the
  // first of the month so the day list isn't empty due to a stale link.
  if (!selectedDay.startsWith(monthKey)) selectedDay = `${monthKey}-01`;

  return { monthStart, selectedDay, monthKey };
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Builds a 6-row x 7-col matrix of days covering the month, padded with
 *  prev/next month days so each row is a full week. Week starts Sunday. */
function buildMonthMatrix(monthStart: Date): Date[][] {
  const firstDow = monthStart.getUTCDay();
  const start = new Date(monthStart);
  start.setUTCDate(start.getUTCDate() - firstDow);
  const rows: Date[][] = [];
  let cursor = start;
  for (let r = 0; r < 6; r += 1) {
    const row: Date[] = [];
    for (let c = 0; c < 7; c += 1) {
      row.push(new Date(cursor));
      cursor = new Date(cursor.getTime() + 86400000);
    }
    rows.push(row);
  }
  return rows;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { monthStart, selectedDay, monthKey: monthKeyStr } = parseMonthAndDay(
    searchParams ?? {},
  );
  const monthEndExclusive = addMonths(monthStart, 1);
  const prevMonth = monthKey(addMonths(monthStart, -1));
  const nextMonth = monthKey(addMonths(monthStart, 1));

  const database = db();

  // Per-day counts for the visible month. We use the enrichment's
  // reference_date so a capture about "next Friday" lands on Friday, not
  // on the day it was typed.
  const dayCountRows = (await database.execute(sql`
    select to_char(${enrichments.referenceDate}, 'YYYY-MM-DD') as day,
           count(*)::int as count
    from ${enrichments}
    where ${enrichments.isCurrent}
      and ${enrichments.referenceDate} >= ${isoDate(monthStart)}
      and ${enrichments.referenceDate} < ${isoDate(monthEndExclusive)}
    group by ${enrichments.referenceDate}
  `)) as unknown as DayRow[];

  const countByDay = new Map<string, number>();
  for (const row of dayCountRows) countByDay.set(row.day, row.count);

  // Captures for the selected day. Join to captures for fallback raw text.
  const dayCaptures = (await database
    .select({
      id: captures.id,
      kind: captures.kind,
      status: captures.status,
      title: enrichments.title,
      summary: enrichments.summary,
      rawText: captures.rawText,
      tags: enrichments.tags,
    })
    .from(enrichments)
    .innerJoin(captures, eq(captures.id, enrichments.captureId))
    .where(
      and(
        eq(enrichments.isCurrent, true),
        gte(enrichments.referenceDate, selectedDay),
        lt(enrichments.referenceDate, isoDay(selectedDay, 1)),
      ),
    )
    .orderBy(asc(captures.capturedAt))) as CaptureRow[];

  const matrix = buildMonthMatrix(monthStart);
  const today = todayIso();
  const monthLabel = `${MONTH_NAMES[monthStart.getUTCMonth()]} ${monthStart.getUTCFullYear()}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/calendar?month=${prevMonth}`}
            className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
            aria-label="Previous month"
          >
            ←
          </Link>
          <span className="min-w-[10ch] text-center font-medium">{monthLabel}</span>
          <Link
            href={`/calendar?month=${nextMonth}`}
            className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
            aria-label="Next month"
          >
            →
          </Link>
          <Link
            href="/calendar"
            className="ml-2 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            Today
          </Link>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {WEEKDAY_HEADERS.map((d) => (
            <div key={d} className="px-2 py-1.5 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {matrix.flat().map((day) => {
            const iso = isoDate(day);
            const inMonth = monthKey(day) === monthKeyStr;
            const isToday = iso === today;
            const isSelected = iso === selectedDay;
            const count = countByDay.get(iso) ?? 0;
            return (
              <Link
                key={iso}
                href={`/calendar?month=${monthKeyStr}&day=${iso}`}
                className={cn(
                  "flex min-h-[64px] flex-col gap-1 p-1.5 text-xs transition-colors",
                  inMonth ? "bg-background" : "bg-muted/10 text-muted-foreground/50",
                  isSelected && "ring-2 ring-primary ring-inset",
                  !isSelected && "hover:bg-accent/50",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {day.getUTCDate()}
                </span>
                {count > 0 ? (
                  <span className="mt-auto inline-flex w-fit items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {formatHeading(selectedDay)} · {dayCaptures.length}{" "}
          {dayCaptures.length === 1 ? "capture" : "captures"}
        </h2>

        {dayCaptures.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            Nothing on this day yet.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {dayCaptures.map((c) => (
              <li key={c.id} className="px-4 py-3 text-sm">
                <Link href={`/inbox/${c.id}`} className="block hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium leading-snug">
                      {c.title ?? c.rawText?.slice(0, 80) ?? "Untitled capture"}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {c.kind}
                    </span>
                  </div>
                  {c.summary ? (
                    <p className="mt-1 line-clamp-2 text-muted-foreground">{c.summary}</p>
                  ) : null}
                  {Array.isArray(c.tags) && c.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.tags.slice(0, 4).map((t) => (
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
      </div>
    </div>
  );
}

function isoDay(iso: string, offset: number): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10)) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + offset));
  return isoDate(dt);
}

function formatHeading(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10)) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dt.getUTCDay()]!;
  return `${weekday}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}
