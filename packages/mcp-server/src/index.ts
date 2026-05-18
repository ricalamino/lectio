#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { createDatabase } from "@lectio/core/db";
import { captures, enrichments } from "@lectio/core/db/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}

const db = createDatabase(databaseUrl);

const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
});
const getSchema = z.object({ id: z.string().uuid() });
const listSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
});

const server = new Server(
  { name: "lectio", version: "0.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_captures",
      description: "Search captures by lexical match on raw text or source URL.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
        },
        required: ["query"],
      },
    },
    {
      name: "get_capture",
      description: "Fetch a single capture and its enrichment by id.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", format: "uuid" } },
        required: ["id"],
      },
    },
    {
      name: "list_recent",
      description: "List the most recent captures.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case "search_captures": {
      const { query, limit } = searchSchema.parse(args ?? {});
      const pattern = `%${query}%`;
      const rows = await db
        .select({
          id: captures.id,
          kind: captures.kind,
          rawText: captures.rawText,
          sourceUrl: captures.sourceUrl,
          capturedAt: captures.capturedAt,
        })
        .from(captures)
        .where(or(ilike(captures.rawText, pattern), ilike(captures.sourceUrl, pattern)))
        .orderBy(desc(captures.capturedAt))
        .limit(limit);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
    case "get_capture": {
      const { id } = getSchema.parse(args ?? {});
      const [capture] = await db.select().from(captures).where(eq(captures.id, id));
      if (!capture) {
        return { content: [{ type: "text", text: "not found" }], isError: true };
      }
      const [enrichment] = await db
        .select()
        .from(enrichments)
        .where(and(eq(enrichments.captureId, id), eq(enrichments.isCurrent, true)));
      return {
        content: [
          { type: "text", text: JSON.stringify({ capture, enrichment }, null, 2) },
        ],
      };
    }
    case "list_recent": {
      const { limit } = listSchema.parse(args ?? {});
      const rows = await db
        .select({
          id: captures.id,
          kind: captures.kind,
          status: captures.status,
          rawText: captures.rawText,
          capturedAt: captures.capturedAt,
        })
        .from(captures)
        .orderBy(desc(captures.capturedAt))
        .limit(limit);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[mcp] fatal", err);
  process.exit(1);
});
