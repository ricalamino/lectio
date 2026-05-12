import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures, connections, enrichments } from "@lectio/core/db/schema";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

export default async function CaptureDetailPage({ params }: Props) {
  const { id } = params;
  const [capture] = await db().select().from(captures).where(eq(captures.id, id)).limit(1);
  if (!capture) notFound();

  const [enrichment] = await db()
    .select()
    .from(enrichments)
    .where(eq(enrichments.captureId, id))
    .limit(1);

  const outgoing = await db()
    .select({
      id: connections.id,
      kind: connections.kind,
      reason: connections.reason,
      otherId: connections.toCaptureId,
      otherTitle: enrichments.title,
    })
    .from(connections)
    .innerJoin(enrichments, eq(enrichments.captureId, connections.toCaptureId))
    .where(eq(connections.fromCaptureId, id))
    .orderBy(desc(connections.createdAt))
    .limit(20);

  const incoming = await db()
    .select({
      id: connections.id,
      kind: connections.kind,
      reason: connections.reason,
      otherId: connections.fromCaptureId,
      otherTitle: enrichments.title,
    })
    .from(connections)
    .innerJoin(enrichments, eq(enrichments.captureId, connections.fromCaptureId))
    .where(eq(connections.toCaptureId, id))
    .orderBy(desc(connections.createdAt))
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/inbox" className="text-sm text-muted-foreground hover:text-foreground">
          ← Inbox
        </Link>
        {capture.mediaKey ? (
          <a
            href={`/api/captures/${capture.id}/media`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Attachment
          </a>
        ) : null}
      </div>

      <header className="space-y-1">
        <p className="text-xs uppercase text-muted-foreground">
          {capture.kind} · {capture.status}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {enrichment?.title?.trim() || "Untitled capture"}
        </h1>
        <p className="text-xs text-muted-foreground">{capture.capturedAt.toISOString()}</p>
      </header>

      {enrichment?.summary ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Summary</h2>
          <p className="text-sm leading-relaxed">{enrichment.summary}</p>
        </section>
      ) : null}

      {enrichment?.transcript ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Transcript</h2>
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm">
            {enrichment.transcript}
          </pre>
        </section>
      ) : null}

      {capture.rawText ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Raw</h2>
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm">
            {capture.rawText}
          </pre>
        </section>
      ) : null}

      {capture.sourceUrl ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Source</h2>
          <a href={capture.sourceUrl} className="break-all text-sm text-primary hover:underline">
            {capture.sourceUrl}
          </a>
        </section>
      ) : null}

      {enrichment?.tags && enrichment.tags.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Tags</h2>
          <p className="text-sm">{enrichment.tags.join(", ")}</p>
        </section>
      ) : null}

      {outgoing.length > 0 || incoming.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Connections</h2>
          <ul className="space-y-2 text-sm">
            {outgoing.map((row) => (
              <li key={`o-${row.id}`} className="rounded-md border border-border px-3 py-2">
                <span className="text-xs uppercase text-muted-foreground">{row.kind}</span>
                <p className="mt-1">
                  →{" "}
                  <Link href={`/inbox/${row.otherId}`} className="font-medium hover:underline">
                    {row.otherTitle}
                  </Link>
                </p>
                <p className="mt-1 text-muted-foreground">{row.reason}</p>
              </li>
            ))}
            {incoming.map((row) => (
              <li key={`i-${row.id}`} className="rounded-md border border-border px-3 py-2">
                <span className="text-xs uppercase text-muted-foreground">{row.kind}</span>
                <p className="mt-1">
                  ←{" "}
                  <Link href={`/inbox/${row.otherId}`} className="font-medium hover:underline">
                    {row.otherTitle}
                  </Link>
                </p>
                <p className="mt-1 text-muted-foreground">{row.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
