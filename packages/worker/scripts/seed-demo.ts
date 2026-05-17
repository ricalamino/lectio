/**
 * Seeds the local Lectio DB with realistic captures for screenshots/demos.
 *
 * Usage (from repo root, with docker compose stack running):
 *   pnpm -F @lectio/worker seed:demo
 *
 * Re-runnable: each run inserts a fresh batch. Use --reset to wipe captures
 * first (DANGEROUS — only do on a demo DB).
 *
 * Requires DATABASE_URL in env. If you run it on the host, point it at the
 * docker postgres (postgres://postgres:<pwd>@localhost:5432/lectio).
 */
import PgBoss from "pg-boss";
import { sql } from "drizzle-orm";
import { createDatabase } from "@lectio/core/db";
import { captures } from "@lectio/core/db/schema";
import { JOB_ENRICH } from "../src/jobs.js";

interface Seed {
  kind: "text" | "link";
  rawText?: string;
  sourceUrl?: string;
}

const SEEDS: Seed[] = [
  {
    kind: "link",
    sourceUrl: "https://www.anthropic.com/news/contextual-retrieval",
    rawText: "Worth re-reading when I design the chunking step.",
  },
  {
    kind: "link",
    sourceUrl: "https://danluu.com/postgres-vs-disk-redundancy/",
    rawText:
      "Dan Luu on why \"just use Postgres\" is the right default for almost everything — including the things people assume need a specialized store. The throughput numbers on commodity hardware are wild.",
  },
  {
    kind: "link",
    sourceUrl: "https://martinfowler.com/articles/feature-toggles.html",
    rawText:
      "Fowler's taxonomy of feature toggles: release vs ops vs experiment vs permission. The big insight is that they all *look* the same in code but rot at very different rates. Mixing them is the source of most toggle-debt.",
  },
  {
    kind: "text",
    rawText:
      "Idea: the bottleneck in a 'second brain' isn't storage or retrieval — it's the friction of capture. If the act of writing something down costs more than 3 seconds of attention, I won't do it. Optimize the first 3 seconds, not the recall UX.",
  },
  {
    kind: "text",
    rawText:
      "Question I keep coming back to: why does Postgres + pgvector feel like the right default for personal RAG, but everyone reaches for a dedicated vector DB the moment scale is mentioned? At <10M vectors HNSW in pg is fine. Maybe the answer is just 'inertia and marketing'.",
  },
  {
    kind: "text",
    rawText:
      "Quote — Rich Hickey, Simple Made Easy: \"We can make things easy without making them simple. The cost is paid later, by someone else, in a context we don't see.\"",
  },
  {
    kind: "text",
    rawText:
      "Reminder: when an LLM call has a JSON output schema, the failure mode I keep hitting is the model returning a string that *looks* like JSON but with smart quotes or trailing commentary. Always validate with Zod, never trust the parse.",
  },
  {
    kind: "link",
    sourceUrl: "https://www.youtube.com/watch?v=oxjT7veKi9c",
    rawText: "Andrej Karpathy's intro to LLMs — best 1-hour overview I've seen.",
  },
  {
    kind: "text",
    rawText:
      "Connection between yesterday's note and the Hickey quote: the 'capture-first' design I'm advocating is actually the *easy* path, not the *simple* one. The simple path would be plain files. Easy = AI does the work. Worth being honest about that tradeoff in the README.",
  },
  {
    kind: "link",
    sourceUrl: "https://maggieappleton.com/lm-sketchbook",
    rawText:
      "Maggie Appleton's sketchbook on language model UX patterns — especially the parts about ambient agents and \"squishy\" interfaces. Influences how I think about Lectio's progressive enrichment.",
  },
  {
    kind: "text",
    rawText:
      "Random observation: every PKM tool I've tried (Obsidian, Logseq, Notion) assumes I want to organize. None of them treat organization as a cost. The whole premise of Lectio is that organization IS the cost, and an LLM should pay it.",
  },
  {
    kind: "text",
    rawText:
      "TODO for the Reddit launch post: pre-warm answers for 'what about privacy?', 'why not use Obsidian + plugins?', 'does it work with [provider X]?'. The thread will live or die in the first 3 replies.",
  },
];

async function main() {
  const reset = process.argv.includes("--reset");
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required. Source your .env first.");
    process.exit(1);
  }

  const db = createDatabase(dbUrl);

  if (reset) {
    console.log("⚠️  --reset: wiping captures table (cascades to enrichments)…");
    await db.execute(sql`TRUNCATE TABLE captures RESTART IDENTITY CASCADE`);
  }

  const boss = new PgBoss({ connectionString: dbUrl });
  await boss.start();
  await boss.createQueue(JOB_ENRICH);

  console.log(`Seeding ${SEEDS.length} captures…`);
  let inserted = 0;
  for (const seed of SEEDS) {
    const [row] = await db
      .insert(captures)
      .values({
        kind: seed.kind,
        rawText: seed.rawText ?? null,
        sourceUrl: seed.sourceUrl ?? null,
        metadata: { source: "seed-demo" },
      })
      .returning({ id: captures.id });
    if (!row) continue;
    await boss.send(JOB_ENRICH, { captureId: row.id }, { retryLimit: 2, retryBackoff: true });
    inserted += 1;
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  await boss.stop({ graceful: true });
  console.log(`Done. ${inserted} captures enqueued for enrichment.`);
  console.log("Wait ~30-60s for the worker to enrich them, then open /inbox.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
