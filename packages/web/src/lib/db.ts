import { llm } from "@lectio/core";
import { createDatabase, type Database } from "@lectio/core/db";
import { env } from "./env";

let cachedDb: Database | null = null;

export function db(): Database {
  if (!cachedDb) cachedDb = createDatabase(env().DATABASE_URL);
  return cachedDb;
}

export function provider(name: llm.LlmProviderName) {
  return llm.createProvider(name);
}
