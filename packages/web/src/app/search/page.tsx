"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
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

type SaveState = "idle" | "saving" | "saved";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [cited, setCited] = useState<Hit[] | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  async function saveAsCapture() {
    if (!answer || !q.trim()) return;
    setSaveState("saving");
    try {
      const text = `Q: ${q.trim()}\n\nA: ${answer.trim()}`;
      const res = await fetch("/api/captures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "text", rawText: text, metadata: { source: "search", searchQuery: q.trim() } }),
      });
      if (res.ok) setSaveState("saved");
      else setSaveState("idle");
    } catch {
      setSaveState("idle");
    }
  }

  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    setAnswer(null);
    setHits(null);
    setCited(null);
    setSaveState("idle");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream")) {
        // Fallback for empty-result non-streaming responses
        const data = (await res.json()) as { answer: string | null; hits: Hit[]; cited?: Hit[] };
        setAnswer(data.answer);
        setHits(data.hits);
        setCited(data.cited ?? []);
        return;
      }
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const dataLine = line.startsWith("data: ") ? line.slice(6) : line.trim();
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine) as
              | { type: "chunk"; text: string }
              | { type: "done"; answer: string; hits: Hit[]; cited: Hit[] }
              | { type: "error" };
            if (event.type === "chunk") {
              setAnswer((prev) => (prev ?? "") + event.text);
            } else if (event.type === "done") {
              setAnswer(event.answer);
              setHits(event.hits);
              setCited(event.cited);
            }
          } catch {
            // skip malformed events
          }
        }
      }
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
          <div className="mb-2 flex items-start justify-between gap-3">
            <SearchAnswerText text={answer} />
            <button
              onClick={() => void saveAsCapture()}
              disabled={saveState === "saving" || saveState === "saved"}
              title={saveState === "saved" ? "Saved" : "Save as Capture"}
              className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {saveState === "saved" ? (
                <BookmarkCheck className="h-4 w-4 text-green-500" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </button>
          </div>
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
        hits.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-6 py-10 text-center">
            <p className="text-sm font-medium">No matches.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try rephrasing — search is natural language, so &ldquo;what did I save about X&rdquo; works.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {hits.map((h) => (
              <li key={h.id} className="px-4 py-3 text-sm">
                <span className="text-muted-foreground text-xs">{h.kind}</span>
                {h.title ? <p className="mt-1 font-medium">{h.title}</p> : null}
                <p className="mt-1">{h.rawText}</p>
                {h.summary ? (
                  <p className="mt-1 text-muted-foreground">{h.summary}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
