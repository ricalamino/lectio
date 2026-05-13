import PgBoss from "pg-boss";
import { createDatabase } from "@lectio/core/db";
import { createProvider, type LlmProviderName } from "@lectio/core/llm";
import { loadEnv } from "./env.js";
import {
  JOB_CONNECT,
  JOB_ENRICH,
  connectJobSchema,
  enrichJobSchema,
} from "./jobs.js";
import { handleEnrich } from "./handlers/enrich.js";
import { handleConnect } from "./handlers/connect.js";

async function main() {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);
  const llm = createProvider(env.LECTIO_ENRICH_PROVIDER as LlmProviderName);
  const embed = env.LECTIO_EMBED_PROVIDER
    ? createProvider(env.LECTIO_EMBED_PROVIDER as LlmProviderName)
    : null;

  const boss = new PgBoss({ connectionString: env.DATABASE_URL });
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();

  // pg-boss 10 requires queues to exist before send/work. createQueue is
  // idempotent — safe to call on every boot.
  await boss.createQueue(JOB_ENRICH);
  await boss.createQueue(JOB_CONNECT);

  const transcribeBackend =
    env.LECTIO_TRANSCRIBE_BACKEND ?? (env.OPENAI_API_KEY ? "openai" : undefined);
  const transcribe = transcribeBackend
    ? {
        backend: transcribeBackend,
        apiKey: env.LECTIO_TRANSCRIBE_API_KEY ?? env.OPENAI_API_KEY,
        baseUrl: env.LECTIO_TRANSCRIBE_URL,
        model: env.LECTIO_WHISPER_MODEL ?? "whisper-1",
      }
    : null;
  const vision = env.OPENAI_API_KEY
    ? { apiKey: env.OPENAI_API_KEY, model: env.LECTIO_VISION_MODEL ?? "gpt-4o-mini" }
    : null;
  const s3 =
    env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY
      ? {
          endpoint: env.S3_ENDPOINT,
          bucket: env.S3_BUCKET,
          accessKey: env.S3_ACCESS_KEY,
          secretKey: env.S3_SECRET_KEY,
        }
      : null;

  await boss.work(JOB_ENRICH, { batchSize: 2 }, async (jobs) => {
    for (const job of jobs) {
      const data = enrichJobSchema.parse(job.data);
      await handleEnrich(data, {
        db,
        llm,
        embed,
        models: { enrich: env.LECTIO_ENRICH_MODEL, embed: env.LECTIO_EMBED_MODEL },
        embedDimensions: env.LECTIO_EMBED_DIMENSIONS,
        transcribe,
        vision,
        s3,
      });
      await boss.send(JOB_CONNECT, { captureId: data.captureId });
    }
  });

  await boss.work(JOB_CONNECT, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      const data = connectJobSchema.parse(job.data);
      await handleConnect(data, { db, llm, model: env.LECTIO_ENRICH_MODEL });
    }
  });

  console.log("[worker] ready");

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} — shutting down`);
    await boss.stop({ graceful: true, timeout: 10_000 });
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
