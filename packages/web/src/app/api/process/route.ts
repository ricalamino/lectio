import { NextResponse } from "next/server";
import { z } from "zod";
import { publishEnrich } from "@/lib/queue";

const schema = z.object({
  captureId: z.string().uuid(),
});

// Manual re-trigger of the background enrichment pipeline for a given
// capture. Useful when a previous run failed and the user wants to retry
// without re-uploading.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const jobId = await publishEnrich({ captureId: parsed.data.captureId });
  return NextResponse.json({ jobId }, { status: 202 });
}
