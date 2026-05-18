"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddAddendum({ captureId }: { captureId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/captures/${captureId}/addendums`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setBody("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add addendum");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Add addendum
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note or correction. Saving re-enriches the capture."
        rows={Math.max(4, body.split("\n").length + 1)}
        className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        autoFocus
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <button
          onClick={() => void submit()}
          disabled={saving || !body.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save & re-enrich"}
        </button>
        <button
          onClick={() => { setBody(""); setError(null); setOpen(false); }}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
