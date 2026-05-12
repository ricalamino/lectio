/**
 * Logseq importer — reads a graph directory (markdown variant).
 *
 * A Logseq graph contains:
 *   pages/<name>.md       — named pages
 *   journals/YYYY_MM_DD.md — daily journals
 *   logseq/, assets/, ... — config and binaries (ignored)
 *
 * One Lectio capture per file. We strip Logseq-specific markers that add
 * no value for an LLM reading the text:
 *   - leading `- ` of every block (Logseq treats every line as a bullet)
 *   - `id::` / `collapsed::` / other `key:: value` property lines
 *   - `#+BEGIN_...` / `#+END_...` org-mode-style fences (rare but present)
 */

export interface LogseqFile {
  path: string;
  content: string;
}

export interface LogseqCapture {
  rawText: string;
  metadata: Record<string, unknown>;
  /** Stable identity within a graph (e.g. "pages/Project Lectio.md"). */
  logseqRelPath: string;
}

const LOGSEQ_PROPERTY_RE = /^\s*[A-Za-z][A-Za-z0-9_-]*::\s.*$/;
const LOGSEQ_ORG_FENCE_RE = /^\s*#\+(BEGIN|END)_[A-Z_]+.*$/;
const JOURNAL_FILENAME_RE = /^(\d{4})[_-](\d{2})[_-](\d{2})\.md$/i;

function isInsideGraph(path: string): boolean {
  return /^(?:.*\/)?(pages|journals)\/[^/]+\.md$/i.test(path);
}

/**
 * Strip the (variable) graph root prefix so the same file gets the same
 * identity across re-zips. "MyGraph/pages/Foo.md" → "pages/Foo.md".
 */
function relPath(path: string): string {
  const m = path.match(/(?:^|\/)((?:pages|journals)\/[^/]+\.md)$/i);
  return m?.[1] ?? path;
}

function fileKind(path: string): "page" | "journal" | null {
  const parts = path.split("/");
  const last = parts[parts.length - 1] ?? "";
  if (/\/journals\//i.test(path) || JOURNAL_FILENAME_RE.test(last)) return "journal";
  if (/\/pages\//i.test(path)) return "page";
  return null;
}

function pageNameFromPath(path: string): string {
  const last = path.split("/").pop() ?? path;
  return decodeURIComponent(last.replace(/\.md$/i, ""));
}

function cleanLogseqMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (LOGSEQ_PROPERTY_RE.test(line)) continue;
    if (LOGSEQ_ORG_FENCE_RE.test(line)) continue;
    // Strip the leading "- " bullet that wraps every block in Logseq.
    // Keep nested indentation intact for readability.
    const stripped = line.replace(/^(\s*)-\s/, "$1");
    out.push(stripped);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function logseqFilesToCaptures(
  files: LogseqFile[],
  options?: { maxFiles?: number; maxCharsPerCapture?: number },
): LogseqCapture[] {
  const maxFiles = options?.maxFiles ?? 2000;
  const maxChars = options?.maxCharsPerCapture ?? 120_000;
  const captures: LogseqCapture[] = [];

  for (const file of files) {
    if (captures.length >= maxFiles) break;
    if (file.path.includes("__MACOSX/") || file.path.startsWith(".")) continue;
    if (!isInsideGraph(file.path)) continue;
    const kind = fileKind(file.path);
    if (!kind) continue;

    const cleaned = cleanLogseqMarkdown(file.content);
    if (!cleaned) continue;

    const name = pageNameFromPath(file.path);
    const logseqRelPath = relPath(file.path);
    const header = kind === "journal" ? `# Journal: ${name}\n\n` : `# ${name}\n\n`;
    const rawText = (header + cleaned).slice(0, maxChars);

    const metadata: Record<string, unknown> = {
      importSource: "logseq",
      logseqKind: kind,
      logseqPath: logseqRelPath,
      logseqName: name,
    };
    if (kind === "journal") {
      const m = name.match(/^(\d{4})[_-](\d{2})[_-](\d{2})$/);
      if (m) metadata.logseqJournalDate = `${m[1]}-${m[2]}-${m[3]}`;
    }

    captures.push({ rawText, metadata, logseqRelPath });
  }

  return captures;
}
