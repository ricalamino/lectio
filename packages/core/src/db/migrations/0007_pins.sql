-- User-pinned items shown on the home Pinned panel and as a shortcut in the
-- sidebar. Polymorphic by `kind`: a pin references either a capture, a tag,
-- or a saved search query. Single-tenant for now; add a user_id column when
-- multi-user lands.

CREATE TABLE IF NOT EXISTS "pins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" text NOT NULL,
  "capture_id" uuid,
  "tag" text,
  "search_query" text,
  "search_label" text,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pins_kind_check" CHECK ("kind" IN ('capture', 'tag', 'search')),
  CONSTRAINT "pins_shape_check" CHECK (
    ("kind" = 'capture' AND "capture_id" IS NOT NULL AND "tag" IS NULL AND "search_query" IS NULL)
    OR ("kind" = 'tag' AND "tag" IS NOT NULL AND "capture_id" IS NULL AND "search_query" IS NULL)
    OR ("kind" = 'search' AND "search_query" IS NOT NULL AND "capture_id" IS NULL AND "tag" IS NULL)
  )
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pins" ADD CONSTRAINT "pins_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pins_capture_unique" ON "pins" ("capture_id") WHERE "kind" = 'capture';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pins_tag_unique" ON "pins" ("tag") WHERE "kind" = 'tag';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pins_search_unique" ON "pins" ("search_query") WHERE "kind" = 'search';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pins_position_idx" ON "pins" ("position");
