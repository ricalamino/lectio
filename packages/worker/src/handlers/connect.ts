import type { Database } from "@lectio/core/db";
import type { ConnectJob } from "../jobs.js";

// Stub. The full connections pipeline (k-NN over pgvector + LLM rationale)
// lives in a follow-up. We register the handler now so jobs published by the
// API don't pile up unhandled while we build it out.
export async function handleConnect(_data: ConnectJob, _deps: { db: Database }): Promise<void> {
  // No-op for now.
}
