CREATE TABLE IF NOT EXISTS "rejected_connection_edges" (
	"from_capture_id" uuid NOT NULL,
	"to_capture_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rejected_connection_edges_pk" PRIMARY KEY("from_capture_id","to_capture_id")
);
--> statement-breakpoint
ALTER TABLE "rejected_connection_edges" ADD CONSTRAINT "rejected_connection_edges_from_capture_id_captures_id_fk" FOREIGN KEY ("from_capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rejected_connection_edges" ADD CONSTRAINT "rejected_connection_edges_to_capture_id_captures_id_fk" FOREIGN KEY ("to_capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rejected_edges_from_idx" ON "rejected_connection_edges" USING btree ("from_capture_id");
--> statement-breakpoint
ALTER TABLE "feedback" DROP CONSTRAINT "feedback_connection_id_connections_id_fk";
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;
