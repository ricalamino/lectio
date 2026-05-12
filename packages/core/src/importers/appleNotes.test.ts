import { describe, expect, it } from "vitest";
import { appleNotesFilesToCaptures } from "./appleNotes.js";

describe("appleNotesFilesToCaptures", () => {
  it("creates one capture per note, capturing folder", () => {
    const out = appleNotesFilesToCaptures([
      { path: "Notes Export/Work/Standup notes.txt", content: "Daily standup\nTopics:" },
      { path: "Notes Export/Personal/Grocery list.md", content: "- milk\n- bread" },
      { path: "Notes Export/__MACOSX/ignore.txt", content: "ignored" },
      { path: "Notes Export/binary.bin", content: "not a note" },
    ]);

    expect(out).toHaveLength(2);
    const work = out.find((c) => c.metadata.appleNotesFolder === "Work");
    expect(work).toBeDefined();
    expect(work!.rawText).toContain("# Standup notes");
    expect(work!.rawText).toContain("Daily standup");
    expect(work!.metadata.importSource).toBe("apple_notes");

    const personal = out.find((c) => c.metadata.appleNotesFolder === "Personal");
    expect(personal).toBeDefined();
    expect(personal!.rawText).toContain("# Grocery list");
  });

  it("works with flat ZIPs without folder grouping", () => {
    const out = appleNotesFilesToCaptures([{ path: "single.txt", content: "alone" }]);
    expect(out).toHaveLength(1);
    expect(out[0]!.metadata.appleNotesFolder).toBeUndefined();
  });
});
