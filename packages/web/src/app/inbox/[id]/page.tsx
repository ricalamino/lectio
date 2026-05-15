import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { captures, enrichments } from "@lectio/core/db/schema";
import { RetryEnrichButton } from "@/components/retry-enrich-button";
import { DeleteCaptureButton, EditRawText } from "@/components/capture-actions";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/inbox" className="text-sm text-muted-foreground hover:text-foreground">
          ← Inbox
        </Link>
        <div className="flex items-center gap-3">
          {capture.mediaKey ? (
            <a
              href={`/api/captures/${capture.id}/media`}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Attachment
            </a>
          ) : null}
          <DeleteCaptureButton captureId={capture.id} />
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

    </div>
  );
}
