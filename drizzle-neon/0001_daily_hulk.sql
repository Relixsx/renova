ALTER TABLE "orders" ADD COLUMN "payment_method" text DEFAULT 'paystack' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "sales_recorded_at" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sold_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "payment_mode" text DEFAULT 'prepaid' NOT NULL;