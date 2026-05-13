import { eq } from "drizzle-orm";
import type { Database } from "@lectio/core/db";
import type { Capture } from "@lectio/core/db/schema";
import { captures, enrichments } from "@lectio/core/db/schema";
import { ocrImageOpenAI } from "@lectio/core/integrations/openai-media";
import { extractPdfText } from "@lectio/core/integrations/pdf";
import { transcribeAudio, type TranscribeConfig } from "@lectio/core/integrations/transcribe";
import { extractAudioFromVideo } from "@lectio/core/integrations/video";
import { type LlmProvider, type LlmProviderName, LlmError } from "@lectio/core/llm";
import {
  ENRICHMENT_SYSTEM_PROMPT,
  buildEnrichmentUserMessage,
  enrichmentOutputSchema,
  type EnrichmentMediaType,
} from "@lectio/core/prompts";
import type { EnrichJob } from "../jobs.js";
import { getObjectBuffer, type S3ReadConfig } from "../lib/s3-get.js";

/** OpenAI vision used for image OCR. Only OpenAI is wired right now. */
export interface VisionOpenAiConfig {
  apiKey: string;
  model: string;
}

export interface EnrichDeps {
  db: Database;
  llm: LlmProvider;
  embed: LlmProvider | null;
  models: { enrich: string; embed?: string };
  /** Expected embedding vector dimension. Must match the DB column. */
  embedDimensions: number;
  /** Transcription backend (OpenAI hosted or any OpenAI-compatible local server). */
  transcribe: TranscribeConfig | null;
  /** OpenAI vision (image OCR). */
  vision: VisionOpenAiConfig | null;
  s3: S3ReadConfig | null;
}

function mediaTypeFor(kind: string): EnrichmentMediaType {
  switch (kind) {
    case "voice":
      return "audio";
    case "image":
      return "image";
    case "link":
      return "link";
    default:
      return "text";
  }
}

function mimeFromCapture(capture: { metadata: unknown }): string | undefined {
  if (!capture.metadata || typeof capture.metadata !== "object") return undefined;
  const m = (capture.metadata as { mimeType?: unknown }).mimeType;
  return typeof m === "string" ? m : undefined;
}

const AUDIO_EXT_RE = /\.(m4a|mp3|webm|wav|ogg|flac|aac|opus)$/i;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp)$/i;
const VIDEO_EXT_RE = /\.(mp4|mov|mkv|webm|avi|m4v|3gp)$/i;
const PDF_EXT_RE = /\.pdf$/i;

function classify(mime: string, filename: string, kind: string): "audio" | "image" | "video" | "pdf" | null {
  if (kind === "voice") return "audio";
  if (kind === "image") return "image";
  if (mime.startsWith("audio/") || AUDIO_EXT_RE.test(filename)) return "audio";
  if (mime.startsWith("image/") || IMAGE_EXT_RE.test(filename)) return "image";
  if (mime.startsWith("video/") || VIDEO_EXT_RE.test(filename)) return "video";
  if (mime === "application/pdf" || PDF_EXT_RE.test(filename)) return "pdf";
  return null;
}

function imageMime(mime: string, filename: string): string {
  if (mime.startsWith("image/")) return mime;
  if (/\.png$/i.test(filename)) return "image/png";
  if (/\.(jpe?g)$/i.test(filename)) return "image/jpeg";
  if (/\.webp$/i.test(filename)) return "image/webp";
  if (/\.gif$/i.test(filename)) return "image/gif";
  return "image/png";
}

async function resolveTextFromMedia(capture: Capture, deps: EnrichDeps): Promise<{ rawContent: string; transcript: string | null }> {
  const base = capture.rawText?.trim() ?? "";
  if (base.length > 0) {
    return { rawContent: base, transcript: null };
  }
  if (!capture.mediaKey || !deps.s3) {
    return { rawContent: "", transcript: null };
  }

  const { buffer, contentType } = await getObjectBuffer(deps.s3, capture.mediaKey);
  const mime = mimeFromCapture(capture) ?? contentType ?? "application/octet-stream";
  const filename = capture.mediaKey.split("/").pop() ?? "media.bin";
  const type = classify(mime, filename, capture.kind);

  if (type === "audio") {
    if (!deps.transcribe) return { rawContent: "", transcript: null };
    const text = (await transcribeAudio({ config: deps.transcribe, buffer, filename })).trim();
    return { rawContent: text, transcript: text || null };
  }

  if (type === "video") {
    if (!deps.transcribe) return { rawContent: "", transcript: null };
    const { audio } = await extractAudioFromVideo({ buffer, filename });
    const text = (
      await transcribeAudio({ config: deps.transcribe, buffer: audio, filename: "audio.mp3" })
    ).trim();
    return { rawContent: text, transcript: text || null };
  }

  if (type === "image") {
    if (!deps.vision) return { rawContent: "", transcript: null };
    const text = await ocrImageOpenAI({
      apiKey: deps.vision.apiKey,
      model: deps.vision.model,
      buffer,
      mimeType: imageMime(mime, filename),
    });
    return { rawContent: text.trim(), transcript: null };
  }

  if (type === "pdf") {
    const { text } = await extractPdfText(buffer);
    return { rawContent: text, transcript: null };
  }

  return { rawContent: "", transcript: null };
}

export async function handleEnrich(data: EnrichJob, deps: EnrichDeps): Promise<void> {
  const [capture] = await deps.db
    .select()
    .from(captures)
    .where(eq(captures.id, data.captureId));
  if (!capture) return;

  let resolved: { rawContent: string; transcript: string | null };
  try {
    resolved = await resolveTextFromMedia(capture, deps);
  } catch (err) {
    console.error("[enrich] media resolution failed", err);
    await deps.db
      .update(captures)
      .set({
        status: "failed",
        updatedAt: new Date(),
        metadata: {
          ...(typeof capture.metadata === "object" && capture.metadata !== null ? capture.metadata : {}),
          enrichError: "media_resolution_failed",
        },
      })
      .where(eq(captures.id, capture.id));
    return;
  }

  if (!resolved.rawContent) {
    await deps.db
      .update(captures)
      .set({
        status: "failed",
        updatedAt: new Date(),
        metadata: {
          ...(typeof capture.metadata === "object" && capture.metadata !== null ? capture.metadata : {}),
          enrichError: "empty_content",
        },
      })
      .where(eq(captures.id, capture.id));
    return;
  }

  if (!capture.rawText?.trim() && resolved.rawContent) {
    await deps.db
      .update(captures)
      .set({ rawText: resolved.rawContent, updatedAt: new Date() })
      .where(eq(captures.id, capture.id));
  }

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
          content: buildEnrichmentUserMessage({
            rawContent: resolved.rawContent,
            mediaType: mediaTypeFor(capture.kind),
          }),
        },
      ],
      schema: enrichmentOutputSchema,
    });

    let embedding: number[] | null = null;
    if (deps.embed && deps.models.embed) {
      const embedded = await deps.embed.embed({
        model: deps.models.embed,
        input: `${json.data.title}\n\n${json.data.summary}\n\n${resolved.rawContent}`,
      });
      const candidate = embedded.embeddings[0] ?? null;
      if (candidate !== null && candidate.length !== deps.embedDimensions) {
        console.warn(
          `[enrich] embedding dimension mismatch: got ${candidate.length}, expected ${deps.embedDimensions} ` +
            `(LECTIO_EMBED_DIMENSIONS). Drop and recreate the embedding column before switching models. Skipping embedding.`,
        );
      } else {
        embedding = candidate;
      }
    }

    await deps.db.insert(enrichments).values({
      captureId: capture.id,
      title: json.data.title,
      summary: json.data.summary,
      tags: json.data.tags,
      entities: json.data.entities,
      suggestedAction: json.data.suggested_action,
      contentType: json.data.content_type,
      transcript: resolved.transcript,
      embedding,
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
