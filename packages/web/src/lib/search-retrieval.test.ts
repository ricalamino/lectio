import { describe, expect, it } from "vitest";
import {
  mergeVectorAndLexicalHits,
  resolveCitationHits,
  type SearchHitRow,
} from "./search-retrieval";

const base = (id: string, title: string): SearchHitRow => ({
  id,
  rawText: null,
  kind: "text",
  capturedAt: new Date(),
  title,
  summary: "",
  tags: [],
  suggestedAction: null,
  mediaKey: null,
});

describe("mergeVectorAndLexicalHits", () => {
  it("prefers vector order then fills from lexical without duplicates", () => {
    const v = [base("aaa", "v1"), base("bbb", "v2")];
    const l = [base("bbb", "lex"), base("ccc", "l1")];
    const merged = mergeVectorAndLexicalHits(v, l, 4);
    expect(merged.map((r) => r.id)).toEqual(["aaa", "bbb", "ccc"]);
  });

  it("respects maxTotal", () => {
    const v = [base("1", ""), base("2", "")];
    const l = [base("3", ""), base("4", "")];
    expect(mergeVectorAndLexicalHits(v, l, 3).map((r) => r.id)).toEqual(["1", "2", "3"]);
  });
});

describe("resolveCitationHits", () => {
  it("resolves 8-char prefixes to hit rows", () => {
    const hits = [base("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "A")];
    const answer = "See [#aaaaaaaa].";
    expect(resolveCitationHits(answer, hits)).toHaveLength(1);
    expect(resolveCitationHits(answer, hits)[0]?.id).toBe(hits[0]?.id);
  });
});
