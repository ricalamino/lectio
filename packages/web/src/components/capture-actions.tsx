"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ---- Delete -----------------------------------------------------------------

export function DeleteCaptureButton({ captureId }: { captureId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function doDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/captures/${captureId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      router.push("/inbox");
      router.refresh();
    } catch {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sure?</span>
      <button
        onClick={() => void doDelete()}
        disabled={loading}
        className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground disabled:opacity-50"
      >
        {loading ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-md border border-border px-3 py-1.5 text-sm"
      >
        Cancel
      </button>
    </span>
  );
}

// ---- Edit rawText -----------------------------------------------------------

export function EditRawText({
  captureId,
  initialText,
}: {
  captureId: string;
  initialText: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!text.trim() || text === initialText) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/captures/${captureId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawText: text.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="group relative">
        <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm">
          {text}
        </pre>
        <button
          onClick={() => setEditing(true)}
          className="absolute right-2 top-2 rounded border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.max(4, text.split("\n").length + 1)}
        className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        autoFocus
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <button
          onClick={() => void save()}
          disabled={saving || !text.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save & re-enrich"}
        </button>
        <button
          onClick={() => { setText(initialText); setEditing(false); }}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
