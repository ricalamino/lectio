import { z } from "zod";

export const JOB_ENRICH = "enrich_capture";
export const JOB_CONNECT = "generate_connections";

export const enrichJobSchema = z.object({ captureId: z.string().uuid() });
export const connectJobSchema = z.object({ captureId: z.string().uuid() });

export type EnrichJob = z.infer<typeof enrichJobSchema>;
export type ConnectJob = z.infer<typeof connectJobSchema>;
