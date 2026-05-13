"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

interface ProcessingStatus {
  pending: number;
  enriching: number;
  failed: number;
}

type BannerState = "hidden" | "processing" | "done" | "failed_only";

const POLL_INTERVAL_MS = 3000;
const DONE_VISIBLE_MS = 4000;

export function EnrichmentProgress() {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [bannerState, setBannerState] = useState<BannerState>("hidden");
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasProcessing = useRef(false);

  function clearDoneTimer() {
    if (doneTimer.current) {
      clearTimeout(doneTimer.current);
      doneTimer.current = null;
    }
  }

  async function poll() {
    try {
      const res = await fetch("/api/captures/processing");
      if (!res.ok) return;
      const data = (await res.json()) as ProcessingStatus;
      setStatus(data);

      const active = data.pending + data.enriching;

      if (active > 0) {
        wasProcessing.current = true;
        clearDoneTimer();
        setBannerState("processing");
        // Keep polling while there's work in progress
        pollRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } else if (wasProcessing.current) {
        // Just finished — show done state briefly
        wasProcessing.current = false;
        setBannerState(data.failed > 0 ? "failed_only" : "done");
        clearDoneTimer();
        doneTimer.current = setTimeout(() => setBannerState("hidden"), DONE_VISIBLE_MS);
        // No more polling needed until new captures come in
      }
      // If active == 0 and wasProcessing was false, stay hidden — nothing to show
    } catch {
      // ignore network errors silently
    }
  }

  useEffect(() => {
    // Initial check
    void poll();

    // Poll on focus to catch activity started in another tab
    const onFocus = () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      void poll();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      if (pollRef.current) clearTimeout(pollRef.current);
      clearDoneTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (bannerState === "hidden" || !status) return null;

  const active = status.pending + status.enriching;

  return (
    <div
      className={`
        fixed bottom-4 left-1/2 z-50 -translate-x-1/2
        flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm shadow-lg
        transition-all duration-300
        ${
          bannerState === "processing"
            ? "border-border bg-background text-foreground"
            : bannerState === "done"
              ? "border-green-500/40 bg-green-500/10 text-green-400"
              : "border-destructive/40 bg-destructive/10 text-destructive"
        }
      `}
    >
      {bannerState === "processing" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>
            Enriching {active} capture{active === 1 ? "" : "s"}…
          </span>
          {status.failed > 0 && (
            <span className="text-xs text-destructive">
              · {status.failed} failed
            </span>
          )}
        </>
      )}

      {bannerState === "done" && (
        <>
          <CheckCircle className="h-3.5 w-3.5" />
          <span>All captures enriched</span>
        </>
      )}

      {bannerState === "failed_only" && (
        <>
          <XCircle className="h-3.5 w-3.5" />
          <span>
            {status.failed} capture{status.failed === 1 ? "" : "s"} failed enrichment
          </span>
        </>
      )}
    </div>
  );
}
