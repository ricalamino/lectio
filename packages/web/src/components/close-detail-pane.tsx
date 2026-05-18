"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

export function CloseDetailPane() {
  const router = useRouter();
  const params = useSearchParams();
  const qs = params.toString();
  const href = qs ? `/inbox?${qs}` : "/inbox";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.push(href);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, href]);

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      aria-label="Close"
      title="Close (Esc)"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
