"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";

interface TagOption {
  tag: string;
  count: number;
}

interface CaptureTagsProps {
  captureId: string;
  initialTags: string[];
}

function normalize(tag: string): string {
  return tag.trim().toLowerCase();
}

export function CaptureTags({ captureId, initialTags }: CaptureTagsProps) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [options, setOptions] = useState<TagOption[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let aborted = false;
    fetch("/api/tags")
      .then((r) => (r.ok ? r.json() : { tags: [] }))
      .then((data: { tags: TagOption[] }) => {
        if (!aborted) setOptions(data.tags ?? []);
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, []);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (editing) renameRef.current?.focus();
  }, [editing]);

  const suggestions = useMemo(() => {
    const q = normalize(draft);
    if (!q) return [] as TagOption[];
    const have = new Set(tags);
    return options
      .filter((o) => o.tag.includes(q) && !have.has(o.tag))
      .slice(0, 6);
  }, [draft, options, tags]);

  async function addTag(value: string) {
    const tag = normalize(value);
    if (!tag) return;
    if (tags.includes(tag)) {
      setDraft("");
      return;
    }
    setBusy(true);
    setError(null);
    const prev = tags;
    setTags([...prev, tag]);
    setDraft("");
    try {
      const res = await fetch(`/api/captures/${captureId}/tags`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ add: [tag] }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { tags: string[] };
      setTags(data.tags);
    } catch (err) {
      setTags(prev);
      setError(err instanceof Error ? err.message : "Failed to add tag");
    } finally {
      setBusy(false);
    }
  }

  async function removeTag(tag: string) {
    setBusy(true);
    setError(null);
    const prev = tags;
    setTags(prev.filter((t) => t !== tag));
    try {
      const res = await fetch(`/api/captures/${captureId}/tags`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ remove: [tag] }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { tags: string[] };
      setTags(data.tags);
    } catch (err) {
      setTags(prev);
      setError(err instanceof Error ? err.message : "Failed to remove tag");
    } finally {
      setBusy(false);
    }
  }

  async function renameTag(from: string, toRaw: string) {
    const to = normalize(toRaw);
    setEditing(null);
    setRenameDraft("");
    if (!to || to === from) return;
    setBusy(true);
    setError(null);
    const prev = tags;
    setTags(prev.map((t) => (t === from ? to : t)).filter((t, i, arr) => arr.indexOf(t) === i));
    try {
      const res = await fetch(`/api/tags/rename`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setTags(prev);
      setError(err instanceof Error ? err.message : "Failed to rename tag");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">Tags</h2>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) =>
          editing === tag ? (
            <span
              key={tag}
              className="inline-flex items-center rounded-full border border-primary bg-background px-1 py-0.5 text-xs"
            >
              <input
                ref={renameRef}
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void renameTag(tag, renameDraft);
                  if (e.key === "Escape") {
                    setEditing(null);
                    setRenameDraft("");
                  }
                }}
                onBlur={() => void renameTag(tag, renameDraft)}
                className="w-24 bg-transparent px-1 py-0 text-xs focus:outline-none"
                disabled={busy}
              />
            </span>
          ) : (
            <span
              key={tag}
              className="group inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-2.5 pr-1 py-0.5 text-xs transition-colors hover:border-foreground"
            >
              <Link
                href={`/search?tag=${encodeURIComponent(tag)}`}
                className="text-muted-foreground hover:text-foreground"
                title={`Search for #${tag}`}
              >
                {tag}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setEditing(tag);
                  setRenameDraft(tag);
                }}
                disabled={busy}
                title="Rename tag everywhere"
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 disabled:opacity-30"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => void removeTag(tag)}
                disabled={busy}
                title="Remove tag from this capture"
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 disabled:opacity-30"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ),
        )}

        {adding ? (
          <span className="relative inline-flex items-center rounded-full border border-primary bg-background px-2 py-0.5 text-xs">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addTag(draft);
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setAdding(false);
                  setDraft("");
                }, 150);
              }}
              placeholder="new tag"
              className="w-28 bg-transparent text-xs focus:outline-none"
              disabled={busy}
            />
            {suggestions.length > 0 ? (
              <ul className="absolute left-0 top-full z-10 mt-1 max-h-48 w-44 overflow-auto rounded-md border border-border bg-popover py-1 text-xs shadow-md">
                {suggestions.map((s) => (
                  <li key={s.tag}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        void addTag(s.tag);
                      }}
                      className="flex w-full items-center justify-between px-2 py-1 text-left hover:bg-muted"
                    >
                      <span>{s.tag}</span>
                      <span className="text-muted-foreground">{s.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            <span>Add</span>
          </button>
        )}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
