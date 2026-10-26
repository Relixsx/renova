CREATE TABLE "reminder_message_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"daily_json" text NOT NULL,
	"arrival_json" text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
DROP INDEX "whatsapp_one_pending_routine";--> statement-breakpoint
ALTER TABLE "order_reminders" ADD COLUMN "message_overrides_json" text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_reminders" ADD COLUMN "reminder_phase" text DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_reminders" ADD COLUMN "arrival_checkpoint" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_reminders" ADD COLUMN "arrival_confirmed_at" text;--> statement-breakpoint
ALTER TABLE "order_reminders" ADD COLUMN "arrival_announced_at" text;--> statement-breakpoint
ALTER TABLE "order_reminders" ADD COLUMN "jumia_delivery_from" date;--> statement-breakpoint
ALTER TABLE "order_reminders" ADD COLUMN "jumia_delivery_to" date;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_one_pending_routine" ON "whatsapp_messages" USING btree ("order_id") WHERE "whatsapp_messages"."kind" IN ('routine', 'arrival_reminder') AND "whatsapp_messages"."status" IN ('pending', 'sending');--> statement-breakpoint
ALTER TABLE "order_reminders" ADD CONSTRAINT "order_reminders_jumia_window_check" CHECK (("order_reminders"."jumia_delivery_from" IS NULL AND "order_reminders"."jumia_delivery_to" IS NULL) OR ("order_reminders"."jumia_delivery_from" IS NOT NULL AND "order_reminders"."jumia_delivery_to" IS NOT NULL AND "order_reminders"."jumia_delivery_to" >= "order_reminders"."jumia_delivery_from"));