CREATE TABLE "whatsapp_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"reminder_id" integer NOT NULL,
	"dedupe_key" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" text NOT NULL,
	"claimed_at" text,
	"provider_message_id" text,
	"error_message" text,
	"accepted_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_receipts" (
	"provider_message_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"error_code" integer,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_reminders" ALTER COLUMN "current_checkpoint" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "whatsapp_phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "whatsapp_consent_at" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "whatsapp_consent_source" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "whatsapp_opted_out_at" text;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_dedupe_unique" ON "whatsapp_messages" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_provider_unique" ON "whatsapp_messages" USING btree ("provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_one_sending_per_order" ON "whatsapp_messages" USING btree ("order_id") WHERE "whatsapp_messages"."status" = 'sending';--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_one_pending_routine" ON "whatsapp_messages" USING btree ("order_id") WHERE "whatsapp_messages"."kind" = 'routine' AND "whatsapp_messages"."status" IN ('pending', 'sending');--> statement-breakpoint
CREATE INDEX "whatsapp_messages_due_idx" ON "whatsapp_messages" USING btree ("status","next_attempt_at");