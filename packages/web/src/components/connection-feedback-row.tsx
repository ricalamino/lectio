"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Kind = "useful" | "noise" | "wrong";

export function ConnectionFeedbackRow({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [removed, setRemoved] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(kind: Kind) {
    setBusy(kind);
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
      if (kind === "useful") {
        setConfirmed(true);
      } else {
        setRemoved(true);
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (removed) return null;

  if (confirmed) {
    return (
      <div className="mt-2 text-xs text-muted-foreground">Saved as a confirmed link.</div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => send("useful")}
          title="Keep this connection and mark it as a good suggestion"
        >
          {busy === "useful" ? "Saving…" : "Confirm"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => send("noise")}
          title="Remove this connection and block this pair from being suggested again"
        >
          {busy === "noise" ? "Removing…" : "Reject"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => send("wrong")}
          title="The two captures are related but the connection type is wrong — remove and block the pair"
        >
          {busy === "wrong" ? "Removing…" : "Wrong type"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
