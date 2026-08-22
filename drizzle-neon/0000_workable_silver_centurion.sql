CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"accent" text DEFAULT 'ember' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"status" text DEFAULT 'payment_pending' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"total_kobo" integer NOT NULL,
	"items_json" text NOT NULL,
	"address_json" text NOT NULL,
	"shipping_json" text NOT NULL,
	"tracking_number" text,
	"estimated_delivery" text,
	"customer_notified_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sku" text NOT NULL,
	"category_slug" text NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_kobo" integer NOT NULL,
	"compare_at_kobo" integer,
	"supplier_cost_kobo" integer,
	"image_url" text NOT NULL,
	"gallery_json" text DEFAULT '[]' NOT NULL,
	"variants_json" text DEFAULT '[]' NOT NULL,
	"specifications_json" text DEFAULT '{}' NOT NULL,
	"brand" text DEFAULT 'Renova Select' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"materials" text DEFAULT '' NOT NULL,
	"dimensions" text DEFAULT '' NOT NULL,
	"weight" text DEFAULT '' NOT NULL,
	"colour" text DEFAULT '' NOT NULL,
	"size" text DEFAULT '' NOT NULL,
	"warranty" text DEFAULT '' NOT NULL,
	"package_contents" text DEFAULT '' NOT NULL,
	"country_of_origin" text DEFAULT '' NOT NULL,
	"care_instructions" text DEFAULT '' NOT NULL,
	"compatibility" text DEFAULT '' NOT NULL,
	"chatbot_knowledge" text DEFAULT '' NOT NULL,
	"chatbot_faq_json" text DEFAULT '[]' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"badge" text,
	"rating" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_test_data" boolean DEFAULT true NOT NULL,
	"supplier_name" text,
	"supplier_url" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_slug" text NOT NULL,
	"reviewer_name" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_test_data" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_seed_unique" ON "reviews" USING btree ("product_slug","reviewer_name");