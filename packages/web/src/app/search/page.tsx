"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchAnswerText } from "@/components/search-answer";

interface Hit {
  id: string;
  rawText: string | null;
  kind: string;
  title: string | null;
  summary: string | null;
  mediaKey: string | null;
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [cited, setCited] = useState<Hit[] | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as {
        answer: string | null;
        hits: Hit[];
        cited?: Hit[];
      };
      setAnswer(data.answer);
      setHits(data.hits);
      setCited(data.cited ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Ask anything…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button onClick={run} disabled={loading}>
          {loading ? "…" : "Search"}
        </Button>
      </div>
      {answer ? (
        <div className="rounded-md border border-border px-4 py-3 text-sm leading-6">
          <SearchAnswerText text={answer} />
        </div>
      ) : null}
      {cited && cited.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Cited sources</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {cited.map((h) => (
              <li
                key={h.id}
                className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{h.kind}</span>
                  <code className="text-[10px] text-muted-foreground">{h.id.slice(0, 8)}</code>
                </div>
                {h.title ? <p className="mt-1 font-medium leading-snug">{h.title}</p> : null}
                {h.summary ? (
                  <p className="mt-1 line-clamp-3 text-muted-foreground leading-snug">{h.summary}</p>
                ) : h.rawText ? (
                  <p className="mt-1 line-clamp-3 text-muted-foreground leading-snug">{h.rawText}</p>
                ) : null}
                {h.mediaKey ? (
                  <Link
                    href={`/api/captures/${h.id}/media`}
                    className="mt-2 inline-block text-xs text-primary underline-offset-4 hover:underline"
                    prefetch={false}
                  >
                    Open attachment
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hits ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {hits.length === 0 ? (
            <li className="px-4 py-3 text-muted-foreground text-sm">No matches.</li>
          ) : (
            hits.map((h) => (
              <li key={h.id} className="px-4 py-3 text-sm">
                <span className="text-muted-foreground text-xs">{h.kind}</span>
                {h.title ? <p className="mt-1 font-medium">{h.title}</p> : null}
                <p className="mt-1">{h.rawText}</p>
                {h.summary ? (
                  <p className="mt-1 text-muted-foreground">{h.summary}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
