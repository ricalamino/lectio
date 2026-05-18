"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Format =
  | "markdown_zip"
  | "whatsapp_txt"
  | "logseq_zip"
  | "apple_notes_zip"
  | "notion_api";

const ACCEPT: Record<Format, string> = {
  markdown_zip: ".zip,application/zip",
  whatsapp_txt: ".txt,text/plain",
  logseq_zip: ".zip,application/zip",
  apple_notes_zip: ".zip,application/zip",
  notion_api: "",
};

export default function ImportPage() {
  const [format, setFormat] = useState<Format>("markdown_zip");
  const [file, setFile] = useState<File | null>(null);
  const [notionToken, setNotionToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const needsFile = format !== "notion_api";

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("format", format);
      if (needsFile) {
        if (!file) {
          setMsg("Pick a file first.");
          return;
        }
        fd.set("file", file);
      } else {
        if (!notionToken.trim()) {
          setMsg("Paste your Notion integration token.");
          return;
        }
        fd.set("notion_token", notionToken.trim());
      }
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = (await res.json()) as {
        inserted?: number;
        updated?: number;
        unchanged?: number;
        totalParsed?: number;
        error?: string;
      };
      if (!res.ok) {
        setMsg(data.error ?? res.statusText);
        return;
      }
      const parts = [
        `${data.inserted ?? 0} new`,
        `${data.updated ?? 0} updated`,
        `${data.unchanged ?? 0} unchanged`,
      ];
      setMsg(`Done. ${parts.join(", ")} (of ${data.totalParsed ?? 0} parsed).`);
      setFile(null);
      if (format === "notion_api") setNotionToken("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Import</h1>
      <p className="text-sm text-muted-foreground">
        Max {5000} items per upload. Each imported item is enriched in the background.
        Re-uploading is safe: Markdown ZIP, Logseq and Notion sources are deduped — unchanged
        items are skipped, changed ones replace the previous content.
      </p>

      <div className="space-y-2">
        <label className="text-sm font-medium">Source</label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as Format)}
          className="block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="markdown_zip">ZIP of Markdown files</option>
          <option value="whatsapp_txt">WhatsApp chat (.txt)</option>
          <option value="logseq_zip">Logseq graph (ZIP)</option>
          <option value="apple_notes_zip">Apple Notes (ZIP from Notes.app export)</option>
          <option value="notion_api">Notion (official API)</option>
        </select>
      </div>

      <FormatHelp format={format} />

      {needsFile ? (
        <div className="space-y-2">
          <label className="text-sm font-medium">File</label>
          <input
            type="file"
            accept={ACCEPT[format]}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="notion-token">
            Notion integration token
          </label>
          <input
            id="notion-token"
            type="password"
            autoComplete="off"
            value={notionToken}
            onChange={(e) => setNotionToken(e.target.value)}
            placeholder="secret_..."
            className="block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
        </div>
      )}

      <Button onClick={() => void run()} disabled={busy || (needsFile && !file)}>
        {busy ? "Importing…" : "Import"}
      </Button>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
    </div>
  );
}

function FormatHelp({ format }: { format: Format }) {
  const body = (() => {
    switch (format) {
      case "markdown_zip":
        return "Upload a ZIP of .md files. Each file becomes one capture.";
      case "whatsapp_txt":
        return "Export a WhatsApp chat as .txt (Without Media). Each message becomes one capture.";
      case "logseq_zip":
        return "Zip up your Logseq graph folder (the one with pages/ and journals/). Each .md inside pages/ or journals/ becomes one capture.";
      case "apple_notes_zip":
        return "Export from Notes.app (or via an exporter tool) to a folder, then zip it. Each .txt or .md becomes one capture; the folder name is kept as a tag.";
      case "notion_api":
        return (
          <>
            Create an internal integration at{" "}
            <a
              className="underline"
              href="https://www.notion.so/profile/integrations"
              target="_blank"
              rel="noreferrer"
            >
              notion.so/profile/integrations
            </a>
            , share the pages/databases you want to import with it, then paste the token here.
          </>
        );
    }
  })();
  return <p className="text-xs text-muted-foreground max-w-2xl">{body}</p>;
}
