"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CaptureStatusCounts } from "@/lib/capture-status-counts";

export type InboxFilterKind = "all" | "processing" | "failed";

const POLL_INTERVAL_MS = 3000;

interface InboxFilterTabsProps {
  activeFilter: InboxFilterKind;
  initialCounts: CaptureStatusCounts;
}

export function InboxFilterTabs({ activeFilter, initialCounts }: InboxFilterTabsProps) {
  const router = useRouter();
  const [counts, setCounts] = useState(initialCounts);
  const lastCountsRef = useRef(initialCounts);

  useEffect(() => {
    setCounts(initialCounts);
    lastCountsRef.current = initialCounts;
  }, [initialCounts]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/captures/processing");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as CaptureStatusCounts;
        if (cancelled) return;
        setCounts(data);
        const last = lastCountsRef.current;
        const changed =
          data.total !== last.total ||
          data.processing !== last.processing ||
          data.failed !== last.failed;
        lastCountsRef.current = data;
        // When counts change, the visible list is stale relative to the badges.
        // Invalidate the Router Cache so the server component re-renders.
        if (changed) router.refresh();
      } catch {
        // ignore network errors
      }
    }

    void refresh();
    const id = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [router]);

  const tabs: { label: string; filter: InboxFilterKind; count: number }[] = [
    { label: "All", filter: "all", count: counts.total },
    { label: "Processing", filter: "processing", count: counts.processing },
    { label: "Failed", filter: "failed", count: counts.failed },
  ];

  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.filter}
          href={tab.filter === "all" ? "/inbox" : `/inbox?filter=${tab.filter}`}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm transition-colors ${
            activeFilter === tab.filter
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
          {tab.count > 0 ? (
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                tab.filter === "failed"
                  ? "bg-destructive/20 text-destructive"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {tab.count}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
