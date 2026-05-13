import Link from "next/link";

export const metadata = {
  title: "Export — Lectio",
};

const formats = [
  {
    href: "/api/export/markdown",
    label: "Download lectio-export.md",
    description: "Plain Markdown — titles, summaries, tags, and raw text. Good for reading and Obsidian/Logseq import.",
  },
  {
    href: "/api/export/json",
    label: "Download lectio-export.json",
    description: "Full JSON — all enrichment fields including entities, content type, and suggested actions. Good for programmatic use.",
  },
];

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Most recent 500 captures, including enrichment data.
        </p>
      </div>
      <ul className="space-y-3">
        {formats.map((f) => (
          <li key={f.href} className="rounded-md border border-border p-4">
            <p className="text-sm text-muted-foreground">{f.description}</p>
            <Link
              href={f.href}
              className="mt-3 inline-flex rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary/80"
            >
              {f.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
