import PgBoss from "pg-boss";
import { env } from "./env";

export const JOB_ENRICH = "enrich_capture";

export interface EnrichJobData {
  captureId: string;
}

let cached: Promise<PgBoss> | null = null;

function start(): Promise<PgBoss> {
  if (cached) return cached;
  const boss = new PgBoss({ connectionString: env().DATABASE_URL });
  cached = boss.start().then(async () => {
    // Queues must exist before send() in pg-boss 10; createQueue is
    // idempotent. Doing it here means a worker-less deploy still queues
    // jobs that a worker can pick up later.
    await boss.createQueue(JOB_ENRICH);
    return boss;
  });
  return cached;
}

export async function publishEnrich(data: EnrichJobData): Promise<string | null> {
  const boss = await start();
  return boss.send(JOB_ENRICH, data, { retryLimit: 2, retryBackoff: true });
}
