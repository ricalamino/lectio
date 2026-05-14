import { describe, expect, it } from "vitest";
import { enrichmentOutputSchema } from "./enrichment.js";

describe("enrichmentOutputSchema", () => {
  it("unwraps a single-item array", () => {
    const parsed = enrichmentOutputSchema.parse([
      {
        title: "one topic",
        summary: "summary",
        tags: ["alpha"],
        entities: {},
        suggested_action: null,
        content_type: "idea",
      },
    ]);

    expect(parsed.title).toBe("one topic");
    expect(parsed.content_type).toBe("idea");
  });

  it("merges multi-topic array responses", () => {
    const parsed = enrichmentOutputSchema.parse([
      {
        title: "support kpis",
        summary: "Support metrics review.",
        tags: ["support", "kpis"],
        entities: { organizations: ["Gorila"] },
        suggested_action: null,
        content_type: "observation",
      },
      {
        title: "generated photos tool",
        summary: "Reference to generated.photos.",
        tags: ["ai-tools", "reference"],
        entities: { organizations: ["Generated Photos"] },
        suggested_action: null,
        content_type: "reference",
      },
    ]);

    expect(parsed.title).toBe("support kpis");
    expect(parsed.summary).toContain("Support metrics review.");
    expect(parsed.summary).toContain("Reference to generated.photos.");
    expect(parsed.tags).toEqual(expect.arrayContaining(["support", "reference", "ai-tools"]));
    expect(parsed.entities.organizations).toEqual(expect.arrayContaining(["Gorila", "Generated Photos"]));
    expect(parsed.content_type).toBe("other");
  });

  it("maps unknown content_type values to other", () => {
    const parsed = enrichmentOutputSchema.parse({
      title: "website project",
      summary: "Website project notes.",
      tags: ["website"],
      entities: {},
      suggested_action: null,
      content_type: "project",
    });

    expect(parsed.content_type).toBe("other");
  });

  it("drops invalid suggested_action payloads", () => {
    const parsed = enrichmentOutputSchema.parse({
      title: "note",
      summary: "note",
      tags: ["note"],
      entities: {},
      suggested_action: { verb: "read" },
      content_type: "idea",
    });

    expect(parsed.suggested_action).toBeNull();
  });
});
