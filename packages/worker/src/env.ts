import { z } from "zod";

// Empty strings come from compose's `${FOO:-}` fallback; treat them as
// unset rather than as invalid values.
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));
const optionalUrl = optionalString.pipe(z.string().url().optional());

const schema = z.object({
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  GOOGLE_API_KEY: optionalString,
  OLLAMA_BASE_URL: optionalUrl,
  OPENROUTER_API_KEY: optionalString,
  S3_ENDPOINT: optionalUrl,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  LECTIO_ENRICH_PROVIDER: z.string().default("anthropic"),
  LECTIO_ENRICH_MODEL: z.string().default("claude-sonnet-4-6"),
  // Transcription. Backend defaults to "openai" when OPENAI_API_KEY is set;
  // set LECTIO_TRANSCRIBE_BACKEND=openai_compatible + LECTIO_TRANSCRIBE_URL
  // to point at a local Whisper server (faster-whisper-server, Speaches, LocalAI,
  // etc.) that implements the OpenAI audio.transcriptions endpoint.
  LECTIO_TRANSCRIBE_BACKEND: optionalString.pipe(
    z.enum(["openai", "openai_compatible"]).optional(),
  ),
  LECTIO_TRANSCRIBE_URL: optionalUrl,
  LECTIO_TRANSCRIBE_API_KEY: optionalString,
  LECTIO_WHISPER_MODEL: optionalString,
  // OCR: still OpenAI-only.
  LECTIO_VISION_MODEL: optionalString,
  // Embeddings are optional in the MVP. When unset, enrichments are stored
  // without a vector and semantic search/connections degrade gracefully to
  // lexical-only.
  LECTIO_EMBED_PROVIDER: optionalString,
  LECTIO_EMBED_MODEL: optionalString,
  // Must match the vector column dimension in the DB (default 1536).
  // If you use a model with different output dimensions (e.g. nomic-embed-text
  // = 768) you must drop and recreate the embedding column first, then set
  // this to the matching value.
  LECTIO_EMBED_DIMENSIONS: z.coerce.number().int().positive().default(1536),
});

export type WorkerEnv = z.infer<typeof schema>;

export function loadEnv(): WorkerEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid worker environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
    );
  }
  return parsed.data;
}
