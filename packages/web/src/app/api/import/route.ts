import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  appleNotesFilesToCaptures,
  importNotionPages,
  logseqFilesToCaptures,
  markdownEntriesToCaptures,
  parseWhatsAppChatExport,
  upsertImportedCapture,
  type UpsertAction,
} from "@lectio/core/importers";
import { captures } from "@lectio/core/db/schema";
import { publishEnrich } from "@/lib/queue";
import JSZip from "jszip";
import { z } from "zod";

const formatSchema = z.enum([
  "whatsapp_txt",
  "markdown_zip",
  "logseq_zip",
  "apple_notes_zip",
  "notion_api",
]);

const MAX_IMPORT = 5000;

interface DedupedRow {
  dedupeKey: string;
  rawText: string;
  metadata: Record<string, unknown>;
  changeMarker?: string;
}
interface PlainRow {
  rawText: string;
  metadata: Record<string, unknown>;
}

async function unzipFiles(buffer: Buffer): Promise<{ path: string; content: string }[]> {
  const zip = await JSZip.loadAsync(buffer);
  const out: { path: string; content: string }[] = [];
  const names = Object.keys(zip.files).filter((n) => !zip.files[n]?.dir);
  for (const name of names) {
    const zf = zip.files[name];
    if (!zf || zf.dir) continue;
    if (name.includes("..") || name.startsWith("/")) continue;
    out.push({ path: name, content: await zf.async("string") });
  }
  return out;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const formatRaw = form.get("format");
  const parsedFormat = formatSchema.safeParse(typeof formatRaw === "string" ? formatRaw : "");
  if (!parsedFormat.success) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  const format = parsedFormat.data;
  const dedupedRows: DedupedRow[] = [];
  const plainRows: PlainRow[] = [];

  if (format === "notion_api") {
    const tokenRaw = form.get("notion_token");
    const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "notion_token is required" }, { status: 400 });
    }
    try {
      const pages = await importNotionPages(token, { maxPages: MAX_IMPORT });
      for (const p of pages) {
        const pageId = p.metadata.notionPageId;
        const lastEdited = p.metadata.notionLastEditedAt;
        if (typeof pageId !== "string") continue;
        dedupedRows.push({
          dedupeKey: `notion:${pageId}`,
          rawText: p.rawText,
          metadata: p.metadata,
          changeMarker: typeof lastEdited === "string" ? lastEdited : undefined,
        });
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Notion import failed: ${(err as Error).message}` },
        { status: 400 },
      );
    }
  } else {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    if (format === "whatsapp_txt") {
      const text = buffer.toString("utf8");
      const chunks = parseWhatsAppChatExport(text, MAX_IMPORT);
      for (const rawText of chunks) {
        plainRows.push({
          rawText,
          metadata: { importSource: "whatsapp_txt", importFile: file.name },
        });
      }
    } else if (format === "markdown_zip") {
      const entries = (await unzipFiles(buffer)).filter((e) => /\.(md|markdown)$/i.test(e.path));
      const caps = markdownEntriesToCaptures(entries, { maxFiles: MAX_IMPORT });
      for (const c of caps) {
        dedupedRows.push({
          dedupeKey: `markdown:${c.relPath}`,
          rawText: c.rawText,
          metadata: { ...c.metadata, importFile: file.name },
        });
      }
    } else if (format === "logseq_zip") {
      const entries = await unzipFiles(buffer);
      const caps = logseqFilesToCaptures(entries, { maxFiles: MAX_IMPORT });
      for (const c of caps) {
        dedupedRows.push({
          dedupeKey: `logseq:${c.logseqRelPath}`,
          rawText: c.rawText,
          metadata: { ...c.metadata, importFile: file.name },
        });
      }
    } else if (format === "apple_notes_zip") {
      const entries = await unzipFiles(buffer);
      const caps = appleNotesFilesToCaptures(entries, { maxFiles: MAX_IMPORT });
      for (const c of caps) {
        plainRows.push({
          rawText: c.rawText,
          metadata: { ...c.metadata, importFile: file.name },
        });
      }
    }
  }

  if (dedupedRows.length === 0 && plainRows.length === 0) {
    return NextResponse.json({ error: "No importable content found" }, { status: 400 });
  }

  const counts: Record<UpsertAction, number> = { inserted: 0, updated: 0, unchanged: 0 };

  // Sources that support dedupe: skip unchanged, re-enqueue updated.
  for (const row of dedupedRows.slice(0, MAX_IMPORT)) {
    const result = await upsertImportedCapture(db(), row);
    counts[result.action] += 1;
    if (result.action !== "unchanged") {
      await publishEnrich({ captureId: result.id });
    }
  }

  // Sources without dedupe (WhatsApp messages, Apple Notes): plain insert.
  for (const row of plainRows.slice(0, MAX_IMPORT - dedupedRows.length)) {
    const [created] = await db()
      .insert(captures)
      .values({ kind: "text", rawText: row.rawText, metadata: row.metadata })
      .returning({ id: captures.id });
    if (created?.id) {
      await publishEnrich({ captureId: created.id });
      counts.inserted += 1;
    }
  }

  const total = counts.inserted + counts.updated + counts.unchanged;
  return NextResponse.json({
    inserted: counts.inserted,
    updated: counts.updated,
    unchanged: counts.unchanged,
    totalParsed: total,
  });
}
