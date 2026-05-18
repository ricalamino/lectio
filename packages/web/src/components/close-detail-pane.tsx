"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function CloseDetailPane() {
  const router = useRouter();

  const close = useCallback(() => {
    // Soft-nav to /inbox. Parallel-slot won't always reset on push, so we also
    // refresh the route tree to swap the slot back to default.tsx.
    router.replace("/inbox", { scroll: false });
    router.refresh();
  }, [router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <button
      type="button"
      onClick={close}
      aria-label="Close"
      title="Close (Esc)"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
