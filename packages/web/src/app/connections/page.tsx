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
      toTitle: toEnrichment.title,
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
        Suggested links between captures. Mark noise or wrong to remove them and block the pair from
        future suggestions.
      </p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No connections yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map(({ connection: c, fromTitle, toTitle }) => (
            <li key={c.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase text-muted-foreground">
                  {c.kind}
                </span>
                <span className="text-xs text-muted-foreground">{c.confidence}</span>
              </div>
              <p className="mt-2 font-medium leading-snug">
                <span className="text-muted-foreground">From:</span> {fromTitle ?? "Untitled"}
              </p>
              <p className="mt-1 font-medium leading-snug">
                <span className="text-muted-foreground">To:</span> {toTitle ?? "Untitled"}
              </p>
              <p className="mt-2 text-muted-foreground leading-relaxed">{c.reason}</p>
              <ConnectionFeedbackRow connectionId={c.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
