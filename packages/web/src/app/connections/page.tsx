import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { ConnectionFeedbackRow } from "@/components/connection-feedback-row";
import { connections, enrichments } from "@lectio/core/db/schema";

export const dynamic = "force-dynamic";

const fromEnrichment = alias(enrichments, "from_enrichment");
const toEnrichment = alias(enrichments, "to_enrichment");

export default async function ConnectionsPage() {
  const rows = await db()
    .select({
      connection: connections,
      fromTitle: fromEnrichment.title,
      fromSummary: fromEnrichment.summary,
      toTitle: toEnrichment.title,
      toSummary: toEnrichment.summary,
    })
    .from(connections)
    .leftJoin(fromEnrichment, eq(fromEnrichment.captureId, connections.fromCaptureId))
    .leftJoin(toEnrichment, eq(toEnrichment.captureId, connections.toCaptureId))
    .orderBy(desc(connections.createdAt))
    .limit(80);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
      <p className="text-sm text-muted-foreground">
        Suggested links between captures. <strong>Confirm</strong> keeps a link and marks it as
        useful. <strong>Reject</strong> removes the link and blocks the pair from being suggested
        again. <strong>Wrong type</strong> also removes it — use when the captures are related but
        the connection label is incorrect.
      </p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No connections yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map(({ connection: c, fromTitle, fromSummary, toTitle, toSummary }) => (
            <li key={c.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase text-muted-foreground">
                  {c.kind}
                </span>
                <span className="text-xs text-muted-foreground">{c.confidence}</span>
              </div>
              <div className="mt-2">
                <span className="text-muted-foreground">From: </span>
                <Link
                  href={`/inbox/${c.fromCaptureId}`}
                  className="font-medium leading-snug text-primary underline-offset-4 hover:underline"
                >
                  {fromTitle ?? "Untitled"}
                </Link>
                {fromSummary ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground leading-snug">
                    {fromSummary}
                  </p>
                ) : null}
              </div>
              <div className="mt-2">
                <span className="text-muted-foreground">To: </span>
                <Link
                  href={`/inbox/${c.toCaptureId}`}
                  className="font-medium leading-snug text-primary underline-offset-4 hover:underline"
                >
                  {toTitle ?? "Untitled"}
                </Link>
                {toSummary ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground leading-snug">
                    {toSummary}
                  </p>
                ) : null}
              </div>
              <p className="mt-2 text-muted-foreground leading-relaxed">{c.reason}</p>
              <ConnectionFeedbackRow connectionId={c.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
