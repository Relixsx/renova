CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`accent` text DEFAULT 'ember' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`customer_phone` text NOT NULL,
	`status` text DEFAULT 'payment_pending' NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`total_kobo` integer NOT NULL,
	`items_json` text NOT NULL,
	`address_json` text NOT NULL,
	`shipping_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sku` text NOT NULL,
	`category_slug` text NOT NULL,
	`short_description` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_kobo` integer NOT NULL,
	`compare_at_kobo` integer,
	`supplier_cost_kobo` integer,
	`image_url` text NOT NULL,
	`gallery_json` text DEFAULT '[]' NOT NULL,
	`variants_json` text DEFAULT '[]' NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`badge` text,
	`rating` integer DEFAULT 0 NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`is_test_data` integer DEFAULT true NOT NULL,
	`supplier_name` text,
	`supplier_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_slug` text NOT NULL,
	`reviewer_name` text NOT NULL,
	`rating` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`is_test_data` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_seed_unique` ON `reviews` (`product_slug`,`reviewer_name`);