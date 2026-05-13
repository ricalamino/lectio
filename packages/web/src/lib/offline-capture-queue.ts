const STORAGE_KEY = "lectio-offline-capture-queue";
const MAX_QUEUED = 50;

export type PendingCapturePayload =
  | { kind: "text"; rawText: string }
  | { kind: "link"; sourceUrl: string; rawText?: string };

export interface PendingCaptureItem {
  id: string;
  createdAt: number;
  payload: PendingCapturePayload;
}

function readRaw(): PendingCaptureItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is PendingCaptureItem =>
        typeof x === "object" &&
        x !== null &&
        "id" in x &&
        "createdAt" in x &&
        "payload" in x &&
        typeof (x as PendingCaptureItem).id === "string" &&
        typeof (x as PendingCaptureItem).payload?.kind === "string",
    );
  } catch {
    return [];
  }
}

function writeAll(items: PendingCaptureItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_QUEUED)));
}

export function listPendingCaptures(): PendingCaptureItem[] {
  return readRaw();
}

export function enqueuePendingCapture(payload: PendingCapturePayload): void {
  if (typeof window === "undefined") return;
  const item: PendingCaptureItem = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    payload,
  };
  const next = [...readRaw(), item];
  writeAll(next);
}

export function removePendingCapture(id: string): void {
  if (typeof window === "undefined") return;
  writeAll(readRaw().filter((x) => x.id !== id));
}

export function replacePendingQueue(items: PendingCaptureItem[]): void {
  if (typeof window === "undefined") return;
  writeAll(items);
}

export function isLikelyOfflineError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  return false;
}
