"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";

type Target =
  | { kind: "capture"; captureId: string }
  | { kind: "tag"; tag: string }
  | { kind: "search"; query: string; label?: string };

interface PinToggleButtonProps {
  target: Target;
  initialPinned: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function PinToggleButton({
  target,
  initialPinned,
  size = "md",
  className,
}: PinToggleButtonProps) {
  const router = useRouter();
  const [pinned, setPinned] = useState(initialPinned);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const prev = pinned;
    setPinned(!prev);
    try {
      if (prev) {
        // Unpin by target so we don't have to track the pin id in props.
        await fetch("/api/pins/by-target", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(targetToBody(target)),
        });
      } else {
        await fetch("/api/pins", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(targetToCreateBody(target)),
        });
      }
      router.refresh();
    } catch {
      setPinned(prev);
    } finally {
      setBusy(false);
    }
  }

  const label = pinned ? "Unpin" : "Pin";
  const dims = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const iconDims = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={label}
      title={label}
      aria-pressed={pinned}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-50",
        dims,
        pinned
          ? "text-primary hover:bg-muted"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <Pin className={cn(iconDims, pinned && "fill-current")} />
    </button>
  );
}

function targetToBody(target: Target) {
  if (target.kind === "capture") return { kind: "capture", captureId: target.captureId };
  if (target.kind === "tag") return { kind: "tag", tag: target.tag };
  return { kind: "search", query: target.query };
}

function targetToCreateBody(target: Target) {
  if (target.kind === "capture") return { kind: "capture", captureId: target.captureId };
  if (target.kind === "tag") return { kind: "tag", tag: target.tag };
  return { kind: "search", query: target.query, label: target.label };
}
