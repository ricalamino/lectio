/**
 * Notion importer — uses the official Notion API with an integration token.
 *
 * The user creates an internal integration at https://www.notion.so/profile/integrations,
 * shares the pages/databases they want to import with it, and pastes the token.
 * We walk every page reachable via /search and flatten its blocks to plain text.
 *
 * One Lectio capture per Notion page. Database rows are pages too.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

type NotionRichText = { plain_text?: string };

interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

interface NotionSearchResult {
  object: "page" | "database";
  id: string;
  url?: string;
  properties?: Record<string, NotionProperty>;
  created_time?: string;
  last_edited_time?: string;
  archived?: boolean;
  parent?: { type: string };
}

interface NotionProperty {
  type: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  [key: string]: unknown;
}

export interface NotionPageCapture {
  rawText: string;
  metadata: Record<string, unknown>;
}

export interface NotionImportOptions {
  maxPages?: number;
  /** Fetch impl — only injected by tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Called with each page id as it is processed (progress). */
  onPage?: (id: string) => void;
}

class NotionClient {
  constructor(
    private token: string,
    private fetchImpl: typeof fetch,
  ) {}

  async request<T>(path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${NOTION_API}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": NOTION_VERSION,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion API ${res.status}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }
}

async function* paginate<T>(
  fetchPage: (cursor?: string) => Promise<{ results: T[]; next_cursor: string | null; has_more: boolean }>,
): AsyncGenerator<T> {
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    for (const item of page.results) yield item;
    cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined;
  } while (cursor);
}

function richTextToString(rt: NotionRichText[] | undefined): string {
  if (!rt) return "";
  return rt.map((t) => t.plain_text ?? "").join("");
}

/**
 * Render a single block to a markdown-ish line. We don't try to reproduce
 * the full markdown — just keep readable text for the LLM.
 */
function renderBlock(block: NotionBlock, depth: number): string {
  const indent = "  ".repeat(depth);
  const type = block.type;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (block as any)[type] as { rich_text?: NotionRichText[]; checked?: boolean; language?: string } | undefined;
  const text = richTextToString(payload?.rich_text);
  switch (type) {
    case "heading_1":
      return `${indent}# ${text}`;
    case "heading_2":
      return `${indent}## ${text}`;
    case "heading_3":
      return `${indent}### ${text}`;
    case "bulleted_list_item":
      return `${indent}- ${text}`;
    case "numbered_list_item":
      return `${indent}1. ${text}`;
    case "to_do":
      return `${indent}- [${payload?.checked ? "x" : " "}] ${text}`;
    case "quote":
      return `${indent}> ${text}`;
    case "code":
      return `${indent}\`\`\`${payload?.language ?? ""}\n${text}\n${indent}\`\`\``;
    case "paragraph":
    case "callout":
    case "toggle":
      return text ? `${indent}${text}` : "";
    case "divider":
      return `${indent}---`;
    case "child_page":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return `${indent}[child page: ${(block as any).child_page?.title ?? ""}]`;
    case "child_database":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return `${indent}[child database: ${(block as any).child_database?.title ?? ""}]`;
    default:
      return text ? `${indent}${text}` : "";
  }
}

async function collectBlockText(
  client: NotionClient,
  blockId: string,
  depth: number,
  out: string[],
  maxDepth = 6,
): Promise<void> {
  if (depth > maxDepth) return;
  for await (const block of paginate<NotionBlock>(async (cursor) => {
    const q = cursor ? `?start_cursor=${encodeURIComponent(cursor)}&page_size=100` : "?page_size=100";
    return client.request(`/blocks/${blockId}/children${q}`);
  })) {
    const line = renderBlock(block, depth);
    if (line) out.push(line);
    if (block.has_children) {
      await collectBlockText(client, block.id, depth + 1, out, maxDepth);
    }
  }
}

function pageTitle(page: NotionSearchResult): string {
  const props = page.properties ?? {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop?.type === "title" && prop.title) {
      const t = richTextToString(prop.title).trim();
      if (t) return t;
    }
  }
  return "Untitled";
}

export async function importNotionPages(
  token: string,
  options?: NotionImportOptions,
): Promise<NotionPageCapture[]> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const maxPages = options?.maxPages ?? 500;
  const client = new NotionClient(token, fetchImpl);

  const pages: NotionPageCapture[] = [];
  let seen = 0;
  for await (const result of paginate<NotionSearchResult>(async (cursor) => {
    return client.request("/search", {
      filter: { value: "page", property: "object" },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
  })) {
    if (result.object !== "page" || result.archived) continue;
    if (seen >= maxPages) break;
    seen += 1;
    options?.onPage?.(result.id);

    const title = pageTitle(result);
    const lines: string[] = [`# ${title}`, ""];
    try {
      await collectBlockText(client, result.id, 0, lines);
    } catch (err) {
      lines.push(`[error fetching blocks: ${(err as Error).message}]`);
    }
    const rawText = lines.join("\n").trim();
    if (!rawText) continue;

    pages.push({
      rawText: rawText.slice(0, 200_000),
      metadata: {
        importSource: "notion",
        notionPageId: result.id,
        notionUrl: result.url ?? null,
        notionLastEditedAt: result.last_edited_time ?? null,
        title,
      },
    });
  }
  return pages;
}
