import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { Pin } from "lucide-react";
import { db } from "@/lib/db";
import { captures, enrichments, pins } from "@lectio/core/db/schema";
import { Button } from "@/components/ui/button";
import { UnpinButton } from "@/components/unpin-button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rows = await db()
    .select({
      id: pins.id,
      kind: pins.kind,
      captureId: pins.captureId,
      tag: pins.tag,
      searchQuery: pins.searchQuery,
      searchLabel: pins.searchLabel,
      captureTitle: enrichments.title,
      captureSummary: enrichments.summary,
      captureRawText: captures.rawText,
      captureKind: captures.kind,
    })
    .from(pins)
    .leftJoin(captures, eq(captures.id, pins.captureId))
    .leftJoin(
      enrichments,
      and(eq(enrichments.captureId, captures.id), eq(enrichments.isCurrent, true)),
    )
    .orderBy(asc(pins.position), desc(pins.createdAt));

  const capturePins = rows.filter((r) => r.kind === "capture");
  const tagPins = rows.filter((r) => r.kind === "tag");
  const searchPins = rows.filter((r) => r.kind === "search");

  const isEmpty = rows.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Pin className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Pinned</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Quick access to your most important captures, tags, and searches.
        </p>
      </header>

      {isEmpty ? (
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium">Nothing pinned yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pin a capture from the inbox, a tag, or a saved search to keep it here.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Button asChild>
              <Link href="/capture">New capture</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/inbox">Open inbox</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {capturePins.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Captures</h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {capturePins.map((p) => {
              const title =
                p.captureTitle?.trim() ||
                p.captureRawText?.slice(0, 80) ||
                "Untitled capture";
              return (
                <li key={p.id} className="text-sm">
                  <div className="flex items-start gap-2 px-4 py-3">
                    <Link
                      href={`/inbox/${p.captureId}`}
                      className="flex-1 min-w-0 hover:text-foreground"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium leading-snug">{title}</span>
                        {p.captureKind ? (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {p.captureKind}
                          </span>
                        ) : null}
                      </div>
                      {p.captureSummary ? (
                        <p className="mt-1 line-clamp-2 text-muted-foreground">
                          {p.captureSummary}
                        </p>
                      ) : p.captureRawText ? (
                        <p className="mt-1 line-clamp-2 text-muted-foreground">
                          {p.captureRawText}
                        </p>
                      ) : null}
                    </Link>
                    <UnpinButton pinId={p.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {tagPins.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Tags</h2>
          <ul className="flex flex-wrap gap-2">
            {tagPins.map((p) => (
              <li key={p.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 pl-3 pr-1 py-1 text-sm">
                <Link
                  href={`/inbox?tab=${encodeURIComponent(p.tag ?? "")}`}
                  className="hover:text-foreground"
                >
                  <span className="text-muted-foreground/60">#</span>
                  {p.tag}
                </Link>
                <UnpinButton pinId={p.id} label={`Unpin #${p.tag}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {searchPins.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Searches</h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {searchPins.map((p) => (
              <li key={p.id} className="text-sm">
                <div className="flex items-center gap-2 px-4 py-3">
                  <Link
                    href={`/search?q=${encodeURIComponent(p.searchQuery ?? "")}`}
                    className="flex-1 min-w-0 hover:text-foreground"
                  >
                    <span className="font-medium">
                      {p.searchLabel?.trim() || p.searchQuery}
                    </span>
                    {p.searchLabel && p.searchQuery ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {p.searchQuery}
                      </p>
                    ) : null}
                  </Link>
                  <UnpinButton pinId={p.id} label="Unpin search" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
