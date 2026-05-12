import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  LECTIO_ENRICH_PROVIDER: z.string().default("anthropic"),
  LECTIO_ENRICH_MODEL: z.string().default("claude-sonnet-4-6"),
  LECTIO_EMBED_PROVIDER: z.string().default("openai"),
  LECTIO_EMBED_MODEL: z.string().default("text-embedding-3-small"),
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
