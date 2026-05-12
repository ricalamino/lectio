CREATE TYPE "public"."capture_kind" AS ENUM('text', 'voice', 'image', 'link', 'file');--> statement-breakpoint
CREATE TYPE "public"."capture_status" AS ENUM('pending', 'enriching', 'enriched', 'failed');--> statement-breakpoint
CREATE TYPE "public"."connection_confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."connection_kind" AS ENUM('continuation', 'contradiction', 'pattern', 'entity_update', 'question_answer');--> statement-breakpoint
CREATE TYPE "public"."feedback_kind" AS ENUM('useful', 'noise', 'wrong', 'edited');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "capture_kind" NOT NULL,
	"status" "capture_status" DEFAULT 'pending' NOT NULL,
	"raw_text" text,
	"source_url" text,
	"media_key" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_capture_id" uuid NOT NULL,
	"to_capture_id" uuid NOT NULL,
	"kind" "connection_kind" NOT NULL,
	"reason" text NOT NULL,
	"confidence" "connection_confidence" NOT NULL,
	"score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrichments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capture_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"suggested_action" jsonb,
	"content_type" text NOT NULL,
	"transcript" text,
	"embedding" vector(1536),
	"model_provider" text NOT NULL,
	"model_name" text NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capture_id" uuid NOT NULL,
	"connection_id" uuid,
	"kind" "feedback_kind" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connections" ADD CONSTRAINT "connections_from_capture_id_captures_id_fk" FOREIGN KEY ("from_capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connections" ADD CONSTRAINT "connections_to_capture_id_captures_id_fk" FOREIGN KEY ("to_capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrichments" ADD CONSTRAINT "enrichments_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "captures_captured_at_idx" ON "captures" USING btree ("captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "captures_status_idx" ON "captures" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connections_from_idx" ON "connections" USING btree ("from_capture_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connections_to_idx" ON "connections" USING btree ("to_capture_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "connections_pair_kind_unique" ON "connections" USING btree ("from_capture_id","to_capture_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enrichments_capture_id_unique" ON "enrichments" USING btree ("capture_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrichments_content_type_idx" ON "enrichments" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_capture_idx" ON "feedback" USING btree ("capture_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrichments_embedding_idx" ON "enrichments" USING hnsw ("embedding" vector_cosine_ops);