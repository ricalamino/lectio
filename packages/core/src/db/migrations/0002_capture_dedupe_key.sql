ALTER TABLE "captures" ADD COLUMN "dedupe_key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "captures_dedupe_key_unique" ON "captures" USING btree ("dedupe_key") WHERE "dedupe_key" IS NOT NULL;
