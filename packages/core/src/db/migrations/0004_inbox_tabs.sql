-- User-configurable quick-access tabs on the inbox. Each tab pins a tag
-- and the inbox filters captures whose enrichment includes that tag.
-- Single-tenant for now; add a user_id column when multi-user lands.

CREATE TABLE IF NOT EXISTS "inbox_tabs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tag" text NOT NULL,
  "label" text,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inbox_tabs_tag_unique" ON "inbox_tabs" ("tag");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_tabs_position_idx" ON "inbox_tabs" ("position");
