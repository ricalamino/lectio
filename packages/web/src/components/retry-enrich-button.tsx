"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetryEnrichButton({ captureId }: { captureId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function retry() {
    setState("loading");
    try {
      const res = await fetch(`/api/captures/${captureId}/enrich`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <button
      onClick={() => void retry()}
      disabled={state === "loading" || state === "done"}
      className="rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      {state === "loading" ? "Retrying…" : state === "done" ? "Queued" : state === "error" ? "Failed — try again" : "Retry enrichment"}
    </button>
  );
}
