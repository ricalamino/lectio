export interface MarkdownZipEntry {
  path: string;
  content: string;
}

export interface MarkdownCapture {
  rawText: string;
  metadata: Record<string, unknown>;
  /** Stable identity within the ZIP. Used as the dedupe key for re-imports. */
  relPath: string;
}

export function markdownEntriesToCaptures(
  entries: MarkdownZipEntry[],
  options?: { maxFiles?: number; maxCharsPerCapture?: number },
): MarkdownCapture[] {
  const maxFiles = options?.maxFiles ?? 2000;
  const maxChars = options?.maxCharsPerCapture ?? 120_000;

  return entries
    .filter((e) => /\.(md|markdown)$/i.test(e.path))
    .filter((e) => !e.path.includes("__MACOSX/") && !e.path.startsWith("."))
    .slice(0, maxFiles)
    .map((e) => {
      const header = `# Imported: ${e.path}\n\n`;
      const body = e.content.trim();
      const rawText = (header + body).slice(0, maxChars);
      return {
        rawText,
        metadata: { importSource: "markdown_zip", importPath: e.path },
        relPath: e.path,
      };
    });
}
