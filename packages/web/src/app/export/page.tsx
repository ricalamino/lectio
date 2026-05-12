import Link from "next/link";

export const metadata = {
  title: "Export — Lectio",
};

export default function ExportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
      <p className="text-sm text-muted-foreground">
        Plain Markdown of your most recent captures (up to 500), including titles, summaries, tags, and
        raw text.
      </p>
      <Link
        href="/api/export/markdown"
        className="inline-flex rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary/80"
      >
        Download lectio-export.md
      </Link>
    </div>
  );
}
