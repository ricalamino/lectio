import { describe, expect, it } from "vitest";
import { importNotionPages } from "./notion.js";

function makeFetchMock(routes: Record<string, unknown>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const route = Object.keys(routes).find((k) => url.includes(k));
    if (!route) throw new Error(`no mock for ${url}`);
    return new Response(JSON.stringify(routes[route]), { status: 200 });
  }) as typeof fetch;
}

describe("importNotionPages", () => {
  it("flattens pages and their block children", async () => {
    const fetchImpl = makeFetchMock({
      "/search": {
        results: [
          {
            object: "page",
            id: "page-1",
            url: "https://notion.so/page-1",
            last_edited_time: "2026-05-01T00:00:00.000Z",
            properties: {
              Name: {
                type: "title",
                title: [{ plain_text: "Hello" }],
              },
            },
          },
        ],
        has_more: false,
        next_cursor: null,
      },
      "/blocks/page-1/children": {
        results: [
          {
            id: "b1",
            type: "paragraph",
            paragraph: { rich_text: [{ plain_text: "first paragraph" }] },
            has_children: false,
          },
          {
            id: "b2",
            type: "bulleted_list_item",
            bulleted_list_item: { rich_text: [{ plain_text: "bullet" }] },
            has_children: false,
          },
        ],
        has_more: false,
        next_cursor: null,
      },
    });

    const out = await importNotionPages("token", { fetchImpl });
    expect(out).toHaveLength(1);
    expect(out[0]!.rawText).toContain("# Hello");
    expect(out[0]!.rawText).toContain("first paragraph");
    expect(out[0]!.rawText).toContain("- bullet");
    expect(out[0]!.metadata.notionPageId).toBe("page-1");
    expect(out[0]!.metadata.importSource).toBe("notion");
  });

  it("skips archived pages", async () => {
    const fetchImpl = makeFetchMock({
      "/search": {
        results: [
          { object: "page", id: "p", archived: true, properties: {} },
        ],
        has_more: false,
        next_cursor: null,
      },
    });
    const out = await importNotionPages("token", { fetchImpl });
    expect(out).toHaveLength(0);
  });
});
