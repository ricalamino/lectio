"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  enqueuePendingCapture,
  isLikelyOfflineError,
  listPendingCaptures,
  removePendingCapture,
  type PendingCaptureItem,
} from "@/lib/offline-capture-queue";

export default function CapturePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [mediaKind, setMediaKind] = useState<"voice" | "image">("image");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingCaptureItem[]>([]);
  const [flushing, setFlushing] = useState(false);

  const refreshPending = useCallback(() => {
    setPending(listPendingCaptures());
  }, []);

  const flushQueue = useCallback(async () => {
    const queue = listPendingCaptures();
    if (queue.length === 0) return;
    setFlushing(true);
    try {
      for (const item of queue) {
        const res = await fetch("/api/captures", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          removePendingCapture(item.id);
        }
      }
      refreshPending();
    } finally {
      setFlushing(false);
    }
  }, [refreshPending]);

  useEffect(() => {
    refreshPending();
    const onOnline = () => {
      void flushQueue();
    };
    window.addEventListener("online", onOnline);
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void flushQueue();
    }
    return () => window.removeEventListener("online", onOnline);
  }, [flushQueue, refreshPending]);

  async function submit() {
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    const payload = { kind: "text" as const, rawText: text.trim() };
    try {
      const res = await fetch("/api/captures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setText("");
      router.push("/inbox");
    } catch (err) {
      if (isLikelyOfflineError(err)) {
        enqueuePendingCapture(payload);
        refreshPending();
        setText("");
        setError("Saved offline — will sync when you are back online.");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMedia() {
    if (!mediaFile) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("kind", mediaKind);
      if (text.trim()) fd.set("rawText", text.trim());
      fd.set("file", mediaFile);
      const res = await fetch("/api/captures", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      setMediaFile(null);
      setText("");
      router.push("/inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Capture</h1>
      {pending.length > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {pending.length} capture{pending.length === 1 ? "" : "s"} queued offline
            </span>
            <Button type="button" size="sm" variant="secondary" disabled={flushing} onClick={() => void flushQueue()}>
              {flushing ? "Syncing…" : "Sync now"}
            </Button>
          </div>
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Text</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind?"
          rows={6}
          className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex items-center gap-3">
          <Button onClick={() => void submit()} disabled={submitting || !text.trim()}>
            {submitting ? "Saving…" : "Save text"}
          </Button>
        </div>
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <h2 className="text-sm font-medium text-muted-foreground">Photo or voice (needs S3 + OpenAI on worker)</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={mediaKind}
            onChange={(e) => setMediaKind(e.target.value as "voice" | "image")}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            <option value="image">Image (OCR)</option>
            <option value="voice">Voice (Whisper)</option>
          </select>
          <input
            type="file"
            accept={mediaKind === "image" ? "image/*" : "audio/*,.m4a,.mp3,.webm,.wav,.ogg"}
            onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
            className="max-w-full text-sm"
          />
        </div>
        <Button onClick={() => void submitMedia()} disabled={submitting || !mediaFile}>
          {submitting ? "Uploading…" : "Save media"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Optional note: you can add text above as context; it is stored with the capture.
        </p>
      </section>

      {error ? <span className="text-sm text-muted-foreground">{error}</span> : null}
    </div>
  );
}
