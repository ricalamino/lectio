"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Hit {
  id: string;
  rawText: string | null;
  kind: string;
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { hits: Hit[] };
      setHits(data.hits);
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
      {hits ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {hits.length === 0 ? (
            <li className="px-4 py-3 text-muted-foreground text-sm">No matches.</li>
          ) : (
            hits.map((h) => (
              <li key={h.id} className="px-4 py-3 text-sm">
                <span className="text-muted-foreground text-xs">{h.kind}</span>
                <p className="mt-1">{h.rawText}</p>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
