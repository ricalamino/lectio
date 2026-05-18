-- Human enrichment via addendums.
--
-- Captures are now mutable in a structured way: users can append text
-- addendums after the initial capture. Each addendum re-runs enrichment over
-- the original raw_text plus all addendums in chronological order, producing
-- a new versioned enrichment row.
--
-- Existing enrichments (one per capture) become version 1, is_current = true.
-- The old "one row per capture" uniqueness is replaced with a partial unique
-- index on (capture_id) WHERE is_current.

CREATE TABLE IF NOT EXISTS "capture_addendums" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "capture_id" uuid NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capture_addendums" ADD CONSTRAINT "capture_addendums_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capture_addendums_capture_idx" ON "capture_addendums" ("capture_id", "created_at");
--> statement-breakpoint
ALTER TABLE "enrichments" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "enrichments" ADD COLUMN IF NOT EXISTS "is_current" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
DROP INDEX IF EXISTS "enrichments_capture_id_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enrichments_capture_id_current_unique" ON "enrichments" ("capture_id") WHERE "is_current";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrichments_capture_version_idx" ON "enrichments" ("capture_id", "version" DESC);
