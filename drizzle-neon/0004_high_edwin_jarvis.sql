ALTER TABLE "products" ADD COLUMN "promo_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_label" text DEFAULT 'PROMO' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_ends_at" text DEFAULT '' NOT NULL;