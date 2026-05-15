import { z } from "zod";

export const JOB_ENRICH = "enrich_capture";

export const enrichJobSchema = z.object({ captureId: z.string().uuid() });

export type EnrichJob = z.infer<typeof enrichJobSchema>;
