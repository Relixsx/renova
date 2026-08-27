ALTER TABLE "products" ADD COLUMN "page_template" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "landing_page_json" text DEFAULT '{}' NOT NULL;