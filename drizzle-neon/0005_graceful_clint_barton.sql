CREATE TABLE "order_reminder_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"reminder_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"checkpoint" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"consent_confirmed" boolean DEFAULT false NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"whatsapp_enabled" boolean DEFAULT false NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"current_checkpoint" text DEFAULT 'Shipped and in transit' NOT NULL,
	"delivery_estimate" text DEFAULT '' NOT NULL,
	"customer_note" text DEFAULT '' NOT NULL,
	"interval_hours" integer DEFAULT 24 NOT NULL,
	"started_at" text,
	"last_sent_at" text,
	"next_send_at" text,
	"stopped_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "order_reminders_order_unique" ON "order_reminders" USING btree ("order_id");