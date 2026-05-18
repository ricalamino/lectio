"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PinOff } from "lucide-react";

interface UnpinButtonProps {
  pinId: string;
  label?: string;
}

export function UnpinButton({ pinId, label = "Unpin" }: UnpinButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function unpin() {
    setBusy(true);
    try {
      await fetch(`/api/pins?id=${encodeURIComponent(pinId)}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void unpin();
      }}
      disabled={busy}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      <PinOff className="h-3.5 w-3.5" />
    </button>
  );
}
