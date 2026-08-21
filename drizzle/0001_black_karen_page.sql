ALTER TABLE `orders` ADD `tracking_number` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `estimated_delivery` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_notified_at` text;--> statement-breakpoint
ALTER TABLE `products` ADD `specifications_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `brand` text DEFAULT 'Renova Select' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `model` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `materials` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `dimensions` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `weight` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `colour` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `size` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `warranty` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `package_contents` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `country_of_origin` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `care_instructions` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `compatibility` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `chatbot_knowledge` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `chatbot_faq_json` text DEFAULT '[]' NOT NULL;