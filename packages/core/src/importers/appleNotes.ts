/**
 * Apple Notes importer — consumes a ZIP exported from macOS Notes.app.
 *
 * Notes.app does not have a built-in "export as text" command, but common
 * community workflows (Exporter app, AppleScript helpers) produce a folder
 * per Notes folder, with one .txt or .md per note. We accept both.
 *
 * One Lectio capture per file. The folder structure becomes a tag.
 */

export interface AppleNotesFile {
  path: string;
  content: string;
}

export interface AppleNotesCapture {
  rawText: string;
  metadata: Record<string, unknown>;
}

const NOTE_EXT_RE = /\.(txt|md|markdown)$/i;

function noteName(path: string): string {
  const last = path.split("/").pop() ?? path;
  return decodeURIComponent(last.replace(NOTE_EXT_RE, ""));
}

function folderName(path: string): string | null {
  const parts = path.split("/").filter((p) => p.length > 0);
  // For "Folder/Note.txt" the folder is parts[parts.length - 2].
  // For a flat ZIP "Note.txt" there is no folder.
  if (parts.length < 2) return null;
  const folder = parts[parts.length - 2];
  if (!folder || folder === "__MACOSX") return null;
  return folder;
}

export function appleNotesFilesToCaptures(
  files: AppleNotesFile[],
  options?: { maxFiles?: number; maxCharsPerCapture?: number },
): AppleNotesCapture[] {
  const maxFiles = options?.maxFiles ?? 5000;
  const maxChars = options?.maxCharsPerCapture ?? 120_000;
  const captures: AppleNotesCapture[] = [];

  for (const file of files) {
    if (captures.length >= maxFiles) break;
    if (file.path.includes("__MACOSX/") || file.path.startsWith(".")) continue;
    if (!NOTE_EXT_RE.test(file.path)) continue;

    const body = file.content.replace(/\r\n/g, "\n").trim();
    if (!body) continue;

    const name = noteName(file.path);
    const folder = folderName(file.path);
    const header = `# ${name}\n\n`;
    const rawText = (header + body).slice(0, maxChars);

    const metadata: Record<string, unknown> = {
      importSource: "apple_notes",
      appleNotesPath: file.path,
      appleNotesTitle: name,
    };
    if (folder) metadata.appleNotesFolder = folder;

    captures.push({ rawText, metadata });
  }

  return captures;
}
