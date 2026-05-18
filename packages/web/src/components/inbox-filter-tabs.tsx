"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { CaptureStatusCounts } from "@/lib/capture-status-counts";

export type StatusFilter = "all" | "processing" | "failed";

export interface InboxTabItem {
  id: string;
  tag: string;
  label: string | null;
  count: number;
}

interface InboxFilterTabsProps {
  activeStatus: StatusFilter;
  activeTab: string | null;
  initialCounts: CaptureStatusCounts;
  initialTabs: InboxTabItem[];
}

interface TagOption {
  tag: string;
  count: number;
}

const POLL_INTERVAL_MS = 3000;

interface CountsResponse extends CaptureStatusCounts {
  tagCounts?: Record<string, number>;
}

export function InboxFilterTabs({
  activeStatus,
  activeTab,
  initialCounts,
  initialTabs,
}: InboxFilterTabsProps) {
  const router = useRouter();
  const [counts, setCounts] = useState<CountsResponse>({
    ...initialCounts,
    tagCounts: Object.fromEntries(initialTabs.map((t) => [t.tag, t.count])),
  });
  const [tabs, setTabs] = useState<InboxTabItem[]>(initialTabs);
  const [adding, setAdding] = useState(false);
  const [tagOptions, setTagOptions] = useState<TagOption[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [pendingTag, setPendingTag] = useState<string | null>(null);
  const lastCountsRef = useRef<CountsResponse>(counts);

  useEffect(() => {
    setTabs(initialTabs);
  }, [initialTabs]);

  useEffect(() => {
    setCounts({
      ...initialCounts,
      tagCounts: Object.fromEntries(initialTabs.map((t) => [t.tag, t.count])),
    });
  }, [initialCounts, initialTabs]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/captures/processing");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as CountsResponse;
        if (cancelled) return;
        setCounts(data);
        const last = lastCountsRef.current;
        const changed =
          data.total !== last.total ||
          data.processing !== last.processing ||
          data.failed !== last.failed;
        lastCountsRef.current = data;
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

  async function loadTagOptions() {
    if (optionsLoaded) return;
    try {
      const res = await fetch("/api/tags");
      if (!res.ok) return;
      const data = (await res.json()) as { tags: TagOption[] };
      setTagOptions(data.tags ?? []);
      setOptionsLoaded(true);
    } catch {
      // ignore
    }
  }

  async function addTab(tag: string) {
    const clean = tag.trim().replace(/^#+/, "");
    if (!clean) return;
    if (tabs.some((t) => t.tag === clean)) {
      setAdding(false);
      return;
    }
    setPendingTag(clean);
    try {
      const res = await fetch("/api/inbox-tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: clean }),
      });
      if (res.ok) {
        setAdding(false);
        router.refresh();
      }
    } finally {
      setPendingTag(null);
    }
  }

  async function removeTab(id: string, tag: string) {
    setTabs((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch(`/api/inbox-tabs?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } finally {
      router.refresh();
      // If the user was currently viewing the removed tab, navigate back to All.
      if (activeTab === tag) router.push("/inbox");
    }
  }

  const isAllActive = activeStatus === "all" && !activeTab;

  // Tags not yet pinned, ordered by usage count.
  const addableOptions = useMemo(() => {
    const pinned = new Set(tabs.map((t) => t.tag));
    return tagOptions.filter((o) => !pinned.has(o.tag));
  }, [tagOptions, tabs]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        <TabLink
          href="/inbox"
          active={isAllActive}
          label="All"
          count={counts.total}
        />
        {tabs.map((tab) => {
          const c = counts.tagCounts?.[tab.tag] ?? tab.count;
          const active = activeTab === tab.tag && activeStatus === "all";
          return (
            <TabLink
              key={tab.id}
              href={`/inbox?tab=${encodeURIComponent(tab.tag)}`}
              active={active}
              label={tab.label ?? `#${tab.tag}`}
              count={c}
              onRemove={() => void removeTab(tab.id, tab.tag)}
            />
          );
        })}
        {adding ? (
          <AddTabPicker
            options={addableOptions}
            optionsLoaded={optionsLoaded}
            pendingTag={pendingTag}
            onLoad={loadTagOptions}
            onSelect={(t) => void addTab(t)}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              void loadTagOptions();
            }}
            className="ml-1 inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title="Pin a tag as a tab"
          >
            <Plus className="h-3.5 w-3.5" />
            Add tab
          </button>
        )}
      </div>

      {counts.processing > 0 || counts.failed > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {counts.processing > 0 ? (
            <StatusChip
              href="/inbox?filter=processing"
              active={activeStatus === "processing"}
              tone="amber"
              label="Processing"
              count={counts.processing}
            />
          ) : null}
          {counts.failed > 0 ? (
            <StatusChip
              href="/inbox?filter=failed"
              active={activeStatus === "failed"}
              tone="destructive"
              label="Failed"
              count={counts.failed}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TabLink({
  href,
  active,
  label,
  count,
  onRemove,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  onRemove?: () => void;
}) {
  return (
    <div
      className={`group relative flex items-center border-b-2 ${
        active ? "border-foreground" : "border-transparent"
      }`}
    >
      <Link
        href={href}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        {count > 0 ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {count}
          </span>
        ) : null}
      </Link>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} tab`}
          className="invisible mr-1 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground group-hover:visible"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function StatusChip({
  href,
  active,
  tone,
  label,
  count,
}: {
  href: string;
  active: boolean;
  tone: "amber" | "destructive";
  label: string;
  count: number;
}) {
  const toneClasses =
    tone === "destructive"
      ? active
        ? "border-destructive bg-destructive/15 text-destructive"
        : "border-destructive/30 bg-destructive/5 text-destructive/80 hover:bg-destructive/10"
      : active
      ? "border-amber-500/60 bg-amber-500/15 text-amber-600"
      : "border-amber-500/30 bg-amber-500/5 text-amber-600/80 hover:bg-amber-500/10";

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors ${toneClasses}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          tone === "destructive" ? "bg-destructive" : "animate-pulse bg-amber-500"
        }`}
      />
      <span>{label}</span>
      <span className="opacity-80">{count}</span>
    </Link>
  );
}

function AddTabPicker({
  options,
  optionsLoaded,
  pendingTag,
  onLoad,
  onSelect,
  onCancel,
}: {
  options: TagOption[];
  optionsLoaded: boolean;
  pendingTag: string | null;
  onLoad: () => void;
  onSelect: (tag: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    onLoad();
  }, [onLoad]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 12);
    return options.filter((o) => o.tag.toLowerCase().includes(q)).slice(0, 12);
  }, [options, query]);

  const trimmed = query.trim().replace(/^#+/, "");
  const showCreate =
    trimmed.length > 0 && !options.some((o) => o.tag.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="relative">
      <div className="flex items-center gap-1 border-b-2 border-transparent px-2 py-1">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && trimmed) onSelect(trimmed);
          }}
          placeholder="Pin a tag…"
          className="w-32 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          disabled={pendingTag !== null}
        />
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {(filtered.length > 0 || showCreate || !optionsLoaded) && (
        <div className="absolute left-0 top-full z-10 mt-1 max-h-64 w-56 overflow-auto rounded-md border border-border bg-background py-1 shadow-md">
          {!optionsLoaded ? (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">Loading…</div>
          ) : null}
          {filtered.map((o) => (
            <button
              key={o.tag}
              type="button"
              onClick={() => onSelect(o.tag)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted"
            >
              <span>
                <span className="text-muted-foreground/60">#</span>
                {o.tag}
              </span>
              <span className="text-xs text-muted-foreground">{o.count}</span>
            </button>
          ))}
          {showCreate ? (
            <button
              type="button"
              onClick={() => onSelect(trimmed)}
              className="flex w-full items-center gap-1 border-t border-border px-3 py-1.5 text-left text-sm hover:bg-muted"
            >
              <Plus className="h-3 w-3" />
              Pin <span className="text-muted-foreground/60">#</span>
              {trimmed}
            </button>
          ) : null}
          {optionsLoaded && filtered.length === 0 && !showCreate ? (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">No tags yet.</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
