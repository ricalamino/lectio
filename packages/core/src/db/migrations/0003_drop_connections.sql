-- Remove the connections feature. Captures + enrichments stay; tags on
-- enrichments now power discovery via search filters instead of an
-- explicit graph of pairwise links.

ALTER TABLE "feedback" DROP COLUMN IF EXISTS "connection_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "rejected_connection_edges";
--> statement-breakpoint
DROP TABLE IF EXISTS "connections";
--> statement-breakpoint
DROP TYPE IF EXISTS "connection_kind";
--> statement-breakpoint
DROP TYPE IF EXISTS "connection_confidence";
