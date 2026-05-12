import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set to run migrations");
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = resolve(here, "./migrations");

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await client`CREATE EXTENSION IF NOT EXISTS vector`;
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
    console.log("migrations applied");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
