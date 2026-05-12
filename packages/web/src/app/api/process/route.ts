import { NextResponse } from "next/server";
import { z } from "zod";
import { publishConnect, publishEnrich } from "@/lib/queue";

const schema = z.object({
  captureId: z.string().uuid(),
  step: z.enum(["enrich", "connect"]).default("enrich"),
});

// Manual re-trigger of the background pipeline for a given capture. Useful
// when a previous run failed and the user wants to retry without re-uploading.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { captureId, step } = parsed.data;
  const jobId =
    step === "enrich"
      ? await publishEnrich({ captureId })
      : await publishConnect({ captureId });
  return NextResponse.json({ jobId, step }, { status: 202 });
}
