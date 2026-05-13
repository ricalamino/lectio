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
  AUTH_SECRET: z.string().min(16),
  ADMIN_PASSWORD: z.string().min(1),
  ANTHROPIC_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  GOOGLE_API_KEY: optionalString,
  OLLAMA_BASE_URL: optionalUrl,
  OPENROUTER_API_KEY: optionalString,
  LECTIO_ENRICH_PROVIDER: z.string().default("anthropic"),
  LECTIO_ENRICH_MODEL: z.string().default("claude-sonnet-4-6"),
  LECTIO_SEARCH_PROVIDER: z.string().default("anthropic"),
  LECTIO_SEARCH_MODEL: z.string().default("claude-sonnet-4-6"),
  LECTIO_EMBED_PROVIDER: optionalString,
  LECTIO_EMBED_MODEL: optionalString,
  S3_ENDPOINT: optionalUrl,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
    );
  }
  cached = parsed.data;
  return cached;
}
