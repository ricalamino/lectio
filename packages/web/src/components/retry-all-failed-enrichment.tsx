"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RetryAllFailedEnrichment({ failedCount }: { failedCount: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function retryAll() {
    setState("loading");
    try {
      const res = await fetch("/api/captures/enrich/retry-failed", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  if (failedCount === 0) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void retryAll()}
      disabled={state === "loading" || state === "done"}
      className="border-destructive text-destructive hover:bg-destructive/10"
    >
      {state === "loading"
        ? "Queueing…"
        : state === "done"
          ? "Queued"
          : state === "error"
            ? "Failed — try again"
            : `Retry all failed (${failedCount})`}
    </Button>
  );
}
