import { describe, expect, it } from "vitest";
import { logseqFilesToCaptures } from "./logseq.js";

describe("logseqFilesToCaptures", () => {
  it("extracts page and journal kinds, stripping bullets and properties", () => {
    const out = logseqFilesToCaptures([
      {
        path: "graph/pages/Project Lectio.md",
        content: [
          "id:: abc-123",
          "collapsed:: true",
          "- The vision for Lectio",
          "  - is a capture-first second brain",
          "- Built on Postgres",
        ].join("\n"),
      },
      {
        path: "graph/journals/2026_05_12.md",
        content: ["- Morning standup", "- Wrote importer code"].join("\n"),
      },
      {
        path: "graph/logseq/config.edn",
        content: "{:meta/version 1}",
      },
      {
        path: "graph/assets/img.png",
        content: "binary-noise",
      },
    ]);

    expect(out).toHaveLength(2);

    const page = out.find((c) => c.metadata.logseqKind === "page");
    expect(page).toBeDefined();
    expect(page!.rawText).toContain("# Project Lectio");
    expect(page!.rawText).toContain("The vision for Lectio");
    expect(page!.rawText).not.toContain("id::");
    expect(page!.rawText).not.toContain("collapsed::");
    expect(page!.rawText).not.toMatch(/^- /m);
    expect(page!.logseqRelPath).toBe("pages/Project Lectio.md");

    const journal = out.find((c) => c.metadata.logseqKind === "journal");
    expect(journal).toBeDefined();
    expect(journal!.metadata.logseqJournalDate).toBe("2026-05-12");
    expect(journal!.rawText).toContain("# Journal: 2026_05_12");
    expect(journal!.logseqRelPath).toBe("journals/2026_05_12.md");
  });

  it("ignores files outside pages/ or journals/", () => {
    const out = logseqFilesToCaptures([
      { path: "graph/README.md", content: "- not in pages" },
      { path: "graph/logseq/recycle/x.md", content: "- nope" },
    ]);
    expect(out).toHaveLength(0);
  });
});
