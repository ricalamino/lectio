import type { EnrichmentOutput } from "./enrichment.js";

/**
 * Resolves the single "calendar anchor" date for an enriched capture.
 *
 * Strategy (first hit wins):
 *   1. The first absolute ISO 8601 date found in `entities.dates`.
 *   2. The first relative expression in `entities.dates` resolved against
 *      `capturedAt` (e.g. "tomorrow", "next Friday").
 *   3. `suggested_action.when` if it parses to a date.
 *   4. The date portion of `capturedAt` (UTC) as the fallback so every
 *      enriched capture lands on exactly one day.
 *
 * Output: `YYYY-MM-DD` string in UTC. Postgres `date` column accepts this
 * directly via the postgres-js driver.
 */
export function resolveReferenceDate(
  enrichment: Pick<EnrichmentOutput, "entities" | "suggested_action">,
  capturedAt: Date,
): string {
  const candidates: string[] = [];
  const dates = enrichment.entities.dates;
  if (Array.isArray(dates)) candidates.push(...dates);
  const when = enrichment.suggested_action?.when;
  if (typeof when === "string" && when.trim().length > 0) candidates.push(when);

  for (const raw of candidates) {
    const resolved = parseDateExpression(raw, capturedAt);
    if (resolved) return resolved;
  }
  return toIsoDate(capturedAt);
}

/** Exported for tests. */
export function parseDateExpression(input: string, anchor: Date): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const iso = matchAbsoluteIso(trimmed);
  if (iso) return iso;

  const ymd = matchYmd(trimmed);
  if (ymd) return ymd;

  const relative = matchRelative(trimmed, anchor);
  if (relative) return relative;

  return null;
}

const ABSOLUTE_ISO_RE = /\b(\d{4}-\d{2}-\d{2})(?:t\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:z|[+-]\d{2}:?\d{2})?)?\b/;

function matchAbsoluteIso(input: string): string | null {
  const m = ABSOLUTE_ISO_RE.exec(input);
  if (!m) return null;
  const date = m[1]!;
  return isValidDate(date) ? date : null;
}

// Numeric formats like "12/03/2026" or "2026/03/12" — accept day-first
// (ISO-ish) and US-style. We can't always disambiguate; bias toward the
// interpretation that yields a valid month/day.
const YMD_RE = /\b(\d{1,4})[\/.-](\d{1,2})[\/.-](\d{1,4})\b/;

function matchYmd(input: string): string | null {
  const m = YMD_RE.exec(input);
  if (!m) return null;
  const [a, b, c] = [m[1]!, m[2]!, m[3]!].map((n) => parseInt(n, 10)) as [number, number, number];
  let y: number, mo: number, d: number;
  if (a > 31) {
    y = a;
    mo = b;
    d = c;
  } else if (c > 31) {
    y = c;
    mo = b > 12 && a <= 12 ? a : b;
    d = b > 12 && a <= 12 ? b : a;
  } else {
    return null;
  }
  return formatDate(y, mo, d);
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

function matchRelative(input: string, anchor: Date): string | null {
  const anchorUtc = startOfUtcDay(anchor);

  if (/\b(today|tonight|this evening|this morning|this afternoon)\b/.test(input)) {
    return toIsoDate(anchorUtc);
  }
  if (/\btomorrow\b/.test(input)) {
    return toIsoDate(addDays(anchorUtc, 1));
  }
  if (/\byesterday\b/.test(input)) {
    return toIsoDate(addDays(anchorUtc, -1));
  }

  const inDays = /\bin\s+(\d{1,3})\s+days?\b/.exec(input);
  if (inDays) return toIsoDate(addDays(anchorUtc, parseInt(inDays[1]!, 10)));

  const inWeeks = /\bin\s+(\d{1,3})\s+weeks?\b/.exec(input);
  if (inWeeks) return toIsoDate(addDays(anchorUtc, parseInt(inWeeks[1]!, 10) * 7));

  const inMonths = /\bin\s+(\d{1,3})\s+months?\b/.exec(input);
  if (inMonths) return toIsoDate(addMonths(anchorUtc, parseInt(inMonths[1]!, 10)));

  // "next monday", "this friday", "by friday", "on friday", "friday"
  const weekday = /\b(?:next|this|by|on|before|until|till|this coming)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/.exec(input);
  if (weekday) {
    const isNext = /\bnext\b/.test(input);
    return toIsoDate(advanceToWeekday(anchorUtc, WEEKDAYS[weekday[1]!]!, isNext));
  }

  // "next week" / "this week" — anchor to the upcoming Monday so the capture
  // doesn't get lost on a vague "next week"
  if (/\bnext week\b/.test(input)) {
    return toIsoDate(advanceToWeekday(anchorUtc, 1, true));
  }

  // "next month" — first day of the following month
  if (/\bnext month\b/.test(input)) {
    const d = addMonths(anchorUtc, 1);
    return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }

  // "<Month> <day>" or "<day> <Month>" with optional year.
  const monthDay = /\b(?:(\d{1,2})\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s*(?:(\d{1,2})(?:st|nd|rd|th)?)?(?:[,\s]+(\d{4}))?\b/.exec(input);
  if (monthDay) {
    const day = parseInt(monthDay[3] ?? monthDay[1] ?? "1", 10);
    const month = MONTHS[monthDay[2]!]!;
    const yearRaw = monthDay[4];
    const year = yearRaw
      ? parseInt(yearRaw, 10)
      : pickNearestYear(anchorUtc, month, day);
    if (isValidYmd(year, month, day)) return formatDate(year, month, day);
  }

  return null;
}

function pickNearestYear(anchor: Date, month: number, day: number): number {
  const year = anchor.getUTCFullYear();
  const candidate = new Date(Date.UTC(year, month - 1, day));
  // If the date this year is in the past relative to anchor, prefer next year.
  if (candidate.getTime() < anchor.getTime() - 24 * 3600 * 1000) return year + 1;
  return year;
}

function advanceToWeekday(anchor: Date, targetDow: number, forceNextWeek: boolean): Date {
  const currentDow = anchor.getUTCDay();
  let diff = (targetDow - currentDow + 7) % 7;
  if (diff === 0) diff = 7;
  if (forceNextWeek && diff < 7) diff += 7;
  return addDays(anchor, diff);
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));
}

function toIsoDate(d: Date): string {
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function formatDate(y: number, m: number, d: number): string {
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

function isValidDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  return isValidYmd(parseInt(m[1]!, 10), parseInt(m[2]!, 10), parseInt(m[3]!, 10));
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
