"use client";

import { useEffect, useState } from "react";
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

// ---- Edit rawText with markdown preview ------------------------------------

type ViewMode = "preview" | "edit";

function MarkdownPreview({ text }: { text: string }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    import("marked").then(({ marked }) => {
      const result = marked(text, { async: false });
      setHtml(result as string);
    });
  }, [text]);

  return (
    <div
      // prose styles are inline so we don't need @tailwindcss/typography
      className="prose prose-sm prose-invert max-w-none rounded-md border border-border bg-muted/30 p-3 text-sm
        [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-0
        [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2
        [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2
        [&_p]:my-1 [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0.5
        [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs
        [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre_code]:bg-transparent [&_pre_code]:px-0
        [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function EditRawText({
  captureId,
  initialText,
}: {
  captureId: string;
  initialText: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>("preview");
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!text.trim() || text === initialText) {
      setMode("preview");
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
      setMode("preview");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-xs">
        <button
          onClick={() => setMode("preview")}
          className={`rounded px-2 py-0.5 ${mode === "preview" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Preview
        </button>
        <button
          onClick={() => setMode("edit")}
          className={`rounded px-2 py-0.5 ${mode === "edit" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Edit
        </button>
      </div>

      {mode === "preview" ? (
        <MarkdownPreview text={text} />
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={Math.max(6, text.split("\n").length + 1)}
            className="w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              onClick={() => { setText(initialText); setMode("preview"); }}
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
