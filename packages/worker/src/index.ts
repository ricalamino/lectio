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
  const embed = createProvider(env.LECTIO_EMBED_PROVIDER as LlmProviderName);

  const boss = new PgBoss({ connectionString: env.DATABASE_URL });
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();

  await boss.work(JOB_ENRICH, { batchSize: 2 }, async (jobs) => {
    for (const job of jobs) {
      const data = enrichJobSchema.parse(job.data);
      await handleEnrich(data, {
        db,
        llm,
        embed,
        models: { enrich: env.LECTIO_ENRICH_MODEL, embed: env.LECTIO_EMBED_MODEL },
      });
    }
  });

  await boss.work(JOB_CONNECT, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      const data = connectJobSchema.parse(job.data);
      await handleConnect(data, { db });
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
