import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { captureAddendums, captures, enrichments, pins } from "@lectio/core/db/schema";
import { RetryEnrichButton } from "@/components/retry-enrich-button";
import { DeleteCaptureButton, EditRawText } from "@/components/capture-actions";
import { AddAddendum } from "@/components/add-addendum";
import { CloseDetailPane } from "@/components/close-detail-pane";
import { CaptureTags } from "@/components/capture-tags";
import { PinToggleButton } from "@/components/pin-toggle-button";

interface CaptureDetailProps {
  id: string;
  variant?: "page" | "pane";
}

export async function CaptureDetail({ id, variant = "page" }: CaptureDetailProps) {
  const [capture] = await db().select().from(captures).where(eq(captures.id, id)).limit(1);
  if (!capture) {
    return (
      <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm font-medium">Capture not found.</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted.</p>
      </div>
    );
  }

  const [enrichment] = await db()
    .select()
    .from(enrichments)
    .where(and(eq(enrichments.captureId, id), eq(enrichments.isCurrent, true)))
    .limit(1);

  const addendums = await db()
    .select({
      id: captureAddendums.id,
      body: captureAddendums.body,
      createdAt: captureAddendums.createdAt,
    })
    .from(captureAddendums)
    .where(eq(captureAddendums.captureId, id))
    .orderBy(asc(captureAddendums.createdAt));

  const [pinned] = await db()
    .select({ id: pins.id })
    .from(pins)
    .where(and(eq(pins.kind, "capture"), eq(pins.captureId, id)))
    .limit(1);
  const isPinned = Boolean(pinned);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        {variant === "page" ? (
          <Link href="/inbox" className="text-sm text-muted-foreground hover:text-foreground">
            ← Inbox
          </Link>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {capture.mediaKey ? (
            <a
              href={`/api/captures/${capture.id}/media`}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Attachment
            </a>
          ) : null}
          <PinToggleButton
            target={{ kind: "capture", captureId: capture.id }}
            initialPinned={isPinned}
            size="sm"
          />
          <DeleteCaptureButton captureId={capture.id} />
          {variant === "pane" ? <CloseDetailPane /> : null}
        </div>
      </div>

      <header className="space-y-1">
        <p className="text-xs uppercase text-muted-foreground">
          {capture.kind} · {capture.status}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {enrichment?.title?.trim() || "Untitled capture"}
        </h1>
        <p className="text-xs text-muted-foreground">{capture.capturedAt.toISOString()}</p>
        {capture.status === "failed" ? (
          <div className="pt-1 space-y-2">
            {(() => {
              const meta =
                capture.metadata &&
                typeof capture.metadata === "object" &&
                !Array.isArray(capture.metadata)
                  ? (capture.metadata as Record<string, unknown>)
                  : null;
              const code = meta?.enrichError as string | undefined;
              const detail = meta?.enrichErrorDetail as string | undefined;
              const label =
                code === "media_resolution_failed"
                  ? "Could not extract content from media"
                  : code === "empty_content"
                    ? "Capture has no content to enrich"
                    : code === "llm_non_retryable"
                      ? "LLM returned a permanent error (check your API key or quota)"
                      : code === "llm_failed"
                        ? "LLM request failed"
                        : null;
              return label ? (
                <p className="text-xs text-red-400">
                  {label}
                  {detail ? ` — ${detail}` : ""}
                </p>
              ) : null;
            })()}
            <RetryEnrichButton captureId={capture.id} />
          </div>
        ) : null}
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
          <EditRawText captureId={capture.id} initialText={capture.rawText} />
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Addendums</h2>
        {addendums.length > 0 ? (
          <ul className="space-y-2">
            {addendums.map((a) => (
              <li key={a.id} className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{a.createdAt.toISOString()}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{a.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            No addendums yet. Add one to extend or correct this capture — it will be re-enriched.
          </p>
        )}
        <AddAddendum captureId={capture.id} />
      </section>

      {capture.sourceUrl ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Source</h2>
          <a href={capture.sourceUrl} className="break-all text-sm text-primary hover:underline">
            {capture.sourceUrl}
          </a>
        </section>
      ) : null}

      {enrichment ? (
        <CaptureTags captureId={capture.id} initialTags={enrichment.tags ?? []} />
      ) : null}
    </div>
  );
}
