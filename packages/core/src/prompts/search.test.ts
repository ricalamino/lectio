import { describe, expect, it } from "vitest";
import { extractCitationIds } from "./search.js";

describe("extractCitationIds", () => {
  it("collects unique 8-char hex prefixes after #", () => {
    const text = "Foo [#a1b2c3d4] bar [#E5F67890] again [#a1b2c3d4].";
    expect(extractCitationIds(text)).toEqual(["a1b2c3d4", "E5F67890"]);
  });

  it("returns empty when there are no citations", () => {
    expect(extractCitationIds("No citations here.")).toEqual([]);
  });
});
