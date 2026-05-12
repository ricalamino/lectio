import { eq } from "drizzle-orm";
import type { Database } from "@lectio/core/db";
import { captures, enrichments } from "@lectio/core/db/schema";
import { type LlmProvider, type LlmProviderName, LlmError } from "@lectio/core/llm";
import {
  ENRICHMENT_SYSTEM_PROMPT,
  enrichmentOutputSchema,
  enrichmentUserPrompt,
} from "@lectio/core/prompts";
import type { EnrichJob } from "../jobs.js";

export interface EnrichDeps {
  db: Database;
  llm: LlmProvider;
  embed: LlmProvider;
  models: { enrich: string; embed: string };
}

export async function handleEnrich(data: EnrichJob, deps: EnrichDeps): Promise<void> {
  const [capture] = await deps.db
    .select()
    .from(captures)
    .where(eq(captures.id, data.captureId));
  if (!capture) return;
  if (!capture.rawText) return;

  await deps.db
    .update(captures)
    .set({ status: "enriching", updatedAt: new Date() })
    .where(eq(captures.id, capture.id));

  try {
    const json = await deps.llm.completeJson({
      model: deps.models.enrich,
      maxTokens: 1024,
      messages: [
        { role: "system", content: ENRICHMENT_SYSTEM_PROMPT },
        {
          role: "user",
          content: enrichmentUserPrompt({
            rawText: capture.rawText,
            kind: capture.kind,
            capturedAt: capture.capturedAt,
            sourceUrl: capture.sourceUrl,
          }),
        },
      ],
      schema: enrichmentOutputSchema,
    });

    const embedded = await deps.embed.embed({
      model: deps.models.embed,
      input: `${json.data.title}\n\n${json.data.summary}\n\n${capture.rawText}`,
    });

    await deps.db.insert(enrichments).values({
      captureId: capture.id,
      title: json.data.title,
      summary: json.data.summary,
      tags: json.data.tags,
      entities: json.data.entities,
      suggestedActions: json.data.suggestedActions,
      embedding: embedded.embeddings[0] ?? null,
      modelProvider: deps.llm.name satisfies LlmProviderName,
      modelName: json.model,
      tokensIn: json.tokensIn,
      tokensOut: json.tokensOut,
    });

    await deps.db
      .update(captures)
      .set({ status: "enriched", updatedAt: new Date() })
      .where(eq(captures.id, capture.id));
  } catch (err) {
    await deps.db
      .update(captures)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(captures.id, capture.id));
    if (err instanceof LlmError && !err.opts.retryable) {
      console.error("[enrich] non-retryable LLM failure", err);
      return;
    }
    throw err;
  }
}
