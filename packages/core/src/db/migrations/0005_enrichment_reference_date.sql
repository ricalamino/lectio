-- Calendar anchor for enriched captures. The worker resolves a date from the
-- enrichment payload (entities.dates / suggested_action.when) using the
-- capture's captured_at as the relative-date anchor, falling back to the date
-- portion of captured_at. Stored as a plain DATE so a capture lands on a
-- single day in the calendar view regardless of timezone of the viewer.

ALTER TABLE "enrichments" ADD COLUMN IF NOT EXISTS "reference_date" date;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrichments_reference_date_idx" ON "enrichments" ("reference_date");
--> statement-breakpoint
-- Backfill existing rows so the calendar isn't blank after upgrade. Use the
-- capture's captured_at date as the fallback anchor.
UPDATE "enrichments" e
SET "reference_date" = (c."captured_at" AT TIME ZONE 'UTC')::date
FROM "captures" c
WHERE e."capture_id" = c."id"
  AND e."reference_date" IS NULL;
