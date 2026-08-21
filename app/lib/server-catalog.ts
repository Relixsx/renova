import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { categories as categoryTable, orders as orderTable, products as productTable, reviews as reviewTable } from "../../db/schema";
import {
  categories,
  seedProducts,
  seedReviews,
  type Category,
  type Product,
  type Review,
} from "./catalog";

let seedAttempted = false;

export async function ensureSeedData() {
  if (seedAttempted) return;
  const db = getDb();

  await db
    .insert(categoryTable)
    .values(
      categories.map((category, index) => ({
        name: category.name,
        slug: category.slug,
        description: category.description,
        accent: category.accent,
        sortOrder: index,
        isActive: true,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(productTable)
    .values(
      seedProducts.map((product) => ({
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        categorySlug: product.categorySlug,
        shortDescription: product.shortDescription,
        description: product.description,
        priceKobo: product.priceKobo,
        compareAtKobo: product.compareAtKobo,
        supplierCostKobo: product.supplierCostKobo,
        imageUrl: product.imageUrl,
        galleryJson: JSON.stringify(product.gallery?.length ? product.gallery : [product.imageUrl]),
        variantsJson: JSON.stringify(product.variants),
        stock: product.stock,
        badge: product.badge,
        rating: product.rating,
        reviewCount: product.reviewCount,
        isFeatured: product.isFeatured,
        isPublished: product.isPublished,
        isTestData: product.isTestData,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(reviewTable)
    .values(
      seedReviews.map((review) => ({
        productSlug: review.productSlug,
        reviewerName: review.reviewerName,
        rating: review.rating,
        title: review.title,
        body: review.body,
        status: "approved",
        isTestData: true,
      })),
    )
    .onConflictDoNothing();

  seedAttempted = true;
}

function mapProduct(row: typeof productTable.$inferSelect): Product {
  let variants: string[] = [];
  let gallery: string[] = [];
  let specifications: Record<string, string> = {};
  let chatbotFaq: Array<{ question: string; answer: string }> = [];
  try {
    variants = JSON.parse(row.variantsJson) as string[];
  } catch {
    variants = [];
  }
  try {
    gallery = JSON.parse(row.galleryJson) as string[];
  } catch {
    gallery = [];
  }
  try { specifications = JSON.parse(row.specificationsJson) as Record<string, string>; } catch { specifications = {}; }
  try { chatbotFaq = JSON.parse(row.chatbotFaqJson) as Array<{ question: string; answer: string }>; } catch { chatbotFaq = []; }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    categorySlug: row.categorySlug,
    shortDescription: row.shortDescription,
    description: row.description,
    priceKobo: row.priceKobo,
    compareAtKobo: row.compareAtKobo,
    supplierCostKobo: row.supplierCostKobo,
    imageUrl: row.imageUrl,
    gallery: gallery.length ? gallery : [row.imageUrl],
    stock: row.stock,
    badge: row.badge,
    rating: row.rating,
    reviewCount: row.reviewCount,
    isFeatured: row.isFeatured,
    isPublished: row.isPublished,
    isTestData: row.isTestData,
    variants,
    specifications,
    brand: row.brand, model: row.model, materials: row.materials, dimensions: row.dimensions,
    weight: row.weight, colour: row.colour, size: row.size, warranty: row.warranty,
    packageContents: row.packageContents, countryOfOrigin: row.countryOfOrigin,
    careInstructions: row.careInstructions, compatibility: row.compatibility,
    chatbotKnowledge: row.chatbotKnowledge, chatbotFaq,
  };
}

export async function getProducts(options?: {
  categorySlug?: string;
  query?: string;
  includeDrafts?: boolean;
}): Promise<Product[]> {
  const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const aliases: Record<string, string> = { phone: "smartphone mobile", phones: "smartphone mobile", laptop: "computer computing", cream: "skincare beauty", sneakers: "shoes footwear", fridge: "refrigerator appliance", tv: "television electronics" };
  const matches = (product: Product, raw: string) => { const words = normalize(raw).split(" ").filter(Boolean).flatMap((word) => [word, ...(aliases[word]?.split(" ") ?? [])]); const haystack = normalize([product.name, product.shortDescription, product.description, product.sku, product.categorySlug, product.brand, product.model, product.colour, product.size].filter(Boolean).join(" ")); return words.every((word) => haystack.includes(word) || (word.length > 4 && haystack.split(" ").some((candidate) => candidate.startsWith(word.slice(0, -1))))); };
  try {
    await ensureSeedData();
    const db = getDb();
    const rows = await db.select().from(productTable).orderBy(asc(productTable.id));
    const query = options?.query?.trim().toLowerCase();
    return rows
      .map(mapProduct)
      .filter((product) => options?.includeDrafts || product.isPublished)
      .filter((product) => !options?.categorySlug || product.categorySlug === options.categorySlug)
      .filter(
        (product) =>
          !query ||
          product.name.toLowerCase().includes(query) ||
          product.shortDescription.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) || matches(product, query),
      );
  } catch {
    const query = options?.query?.trim().toLowerCase();
    return seedProducts
      .filter((product) => options?.includeDrafts || product.isPublished)
      .filter((product) => !options?.categorySlug || product.categorySlug === options.categorySlug)
      .filter(
        (product) =>
          !query ||
          product.name.toLowerCase().includes(query) ||
          product.shortDescription.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) || matches(product, query),
      );
  }
}

export async function getProduct(slug: string): Promise<Product | null> {
  try {
    await ensureSeedData();
    const db = getDb();
    const [row] = await db
      .select()
      .from(productTable)
      .where(eq(productTable.slug, slug))
      .limit(1);
    return row ? mapProduct(row) : null;
  } catch {
    return seedProducts.find((product) => product.slug === slug) ?? null;
  }
}

export async function getReviews(slug: string): Promise<Review[]> {
  try {
    await ensureSeedData();
    const db = getDb();
    const rows = await db
      .select()
      .from(reviewTable)
      .where(eq(reviewTable.productSlug, slug))
      .orderBy(asc(reviewTable.id));
    return rows
      .filter((review) => review.status === "approved")
      .map((review) => ({
        id: review.id,
        productSlug: review.productSlug,
        reviewerName: review.reviewerName,
        rating: review.rating,
        title: review.title,
        body: review.body,
        isTestData: review.isTestData,
        status: review.status,
      }));
  } catch {
    return seedReviews.filter((review) => review.productSlug === slug);
  }
}

export async function getAdminReviews(): Promise<Review[]> {
  await ensureSeedData();
  const rows = await getDb().select().from(reviewTable).orderBy(desc(reviewTable.id));
  return rows.map((review) => ({
    id: review.id,
    productSlug: review.productSlug,
    reviewerName: review.reviewerName,
    rating: review.rating,
    title: review.title,
    body: review.body,
    status: review.status,
    isTestData: review.isTestData,
  }));
}

export async function getAdminOrders() {
  await ensureSeedData();
  return getDb().select().from(orderTable).orderBy(desc(orderTable.id));
}

export async function getCategories(): Promise<Category[]> {
  return categories;
}
