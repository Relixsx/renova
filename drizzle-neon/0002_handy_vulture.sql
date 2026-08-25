ALTER TABLE "reviews" ADD COLUMN "is_verified_purchase" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "reviewed_at" text;