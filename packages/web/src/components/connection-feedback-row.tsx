"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConnectionFeedbackRow({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(kind: "useful" | "noise" | "wrong") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections/${connectionId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) {
        const t = await res.text();
        setError(t || res.statusText);
        return;
      }
      if (kind !== "useful") {
        setRemoved(true);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (removed) return null;

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => send("useful")}>
          Useful
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => send("noise")}>
          Not a link
        </Button>
        <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => send("wrong")}>
          Wrong
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
