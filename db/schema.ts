import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  accent: text("accent").notNull().default("ember"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sku: text("sku").notNull().unique(),
  categorySlug: text("category_slug").notNull(),
  shortDescription: text("short_description").notNull().default(""),
  description: text("description").notNull().default(""),
  priceKobo: integer("price_kobo").notNull(),
  compareAtKobo: integer("compare_at_kobo"),
  supplierCostKobo: integer("supplier_cost_kobo"),
  imageUrl: text("image_url").notNull(),
  galleryJson: text("gallery_json").notNull().default("[]"),
  variantsJson: text("variants_json").notNull().default("[]"),
  specificationsJson: text("specifications_json").notNull().default("{}"),
  brand: text("brand").notNull().default("Renova Select"),
  model: text("model").notNull().default(""),
  materials: text("materials").notNull().default(""),
  dimensions: text("dimensions").notNull().default(""),
  weight: text("weight").notNull().default(""),
  colour: text("colour").notNull().default(""),
  size: text("size").notNull().default(""),
  warranty: text("warranty").notNull().default(""),
  packageContents: text("package_contents").notNull().default(""),
  countryOfOrigin: text("country_of_origin").notNull().default(""),
  careInstructions: text("care_instructions").notNull().default(""),
  compatibility: text("compatibility").notNull().default(""),
  chatbotKnowledge: text("chatbot_knowledge").notNull().default(""),
  chatbotFaqJson: text("chatbot_faq_json").notNull().default("[]"),
  stock: integer("stock").notNull().default(0),
  soldCount: integer("sold_count").notNull().default(0),
  paymentMode: text("payment_mode").notNull().default("prepaid"),
  badge: text("badge"),
  rating: integer("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(false),
  isTestData: boolean("is_test_data").notNull().default(true),
  supplierName: text("supplier_name"),
  supplierUrl: text("supplier_url"),
  pageTemplate: text("page_template").notNull().default("standard"),
  landingPageJson: text("landing_page_json").notNull().default("{}"),
  promoEnabled: boolean("promo_enabled").notNull().default(false),
  promoLabel: text("promo_label").notNull().default("PROMO"),
  promoEndsAt: text("promo_ends_at").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
});

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    productSlug: text("product_slug").notNull(),
    reviewerName: text("reviewer_name").notNull(),
    rating: integer("rating").notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull(),
    status: text("status").notNull().default("pending"),
    isTestData: boolean("is_test_data").notNull().default(true),
    isVerifiedPurchase: boolean("is_verified_purchase")
      .notNull()
      .default(false),
    reviewedAt: text("reviewed_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP::text`),
  },
  (table) => [
    uniqueIndex("reviews_seed_unique").on(
      table.productSlug,
      table.reviewerName,
    ),
  ],
);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  status: text("status").notNull().default("payment_pending"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentMethod: text("payment_method").notNull().default("paystack"),
  totalKobo: integer("total_kobo").notNull(),
  itemsJson: text("items_json").notNull(),
  addressJson: text("address_json").notNull(),
  shippingJson: text("shipping_json").notNull(),
  trackingNumber: text("tracking_number"),
  estimatedDelivery: text("estimated_delivery"),
  customerNotifiedAt: text("customer_notified_at"),
  salesRecordedAt: text("sales_recorded_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP::text`),
});

export const orderReminders = pgTable(
  "order_reminders",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull(),
    active: boolean("active").notNull().default(false),
    consentConfirmed: boolean("consent_confirmed").notNull().default(false),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    whatsappEnabled: boolean("whatsapp_enabled").notNull().default(false),
    smsEnabled: boolean("sms_enabled").notNull().default(false),
    currentCheckpoint: text("current_checkpoint").notNull().default("Shipped and in transit"),
    deliveryEstimate: text("delivery_estimate").notNull().default(""),
    customerNote: text("customer_note").notNull().default(""),
    intervalHours: integer("interval_hours").notNull().default(24),
    startedAt: text("started_at"),
    lastSentAt: text("last_sent_at"),
    nextSendAt: text("next_send_at"),
    stoppedAt: text("stopped_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP::text`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP::text`),
  },
  (table) => [uniqueIndex("order_reminders_order_unique").on(table.orderId)],
);

export const orderReminderLogs = pgTable("order_reminder_logs", {
  id: serial("id").primaryKey(),
  reminderId: integer("reminder_id").notNull(),
  orderId: integer("order_id").notNull(),
  channel: text("channel").notNull(),
  status: text("status").notNull(),
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  checkpoint: text("checkpoint").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP::text`),
});
