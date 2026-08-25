import { and, asc, desc, eq } from "drizzle-orm";
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

  // Upgrade only untouched built-in cover images. Owner-uploaded replacements are preserved.
  const whiteBackgroundCovers = [
    ["aura-quietmax-wireless-headphones", "/products/aura-headphones.webp", "/products/aura-headphones-white.webp"],
    ["embergo-portable-blender", "/products/ember-blender.webp", "/products/ember-blender-white.webp"],
    ["atelier-structured-everyday-handbag", "/products/atelier-handbag.webp", "/products/atelier-handbag-white.webp"],
    ["nova-x1-5g-smartphone", "/products/nova-smartphone.webp", "/products/nova-smartphone-white.webp"],
  ] as const;
  for (const [slug, previousUrl, nextUrl] of whiteBackgroundCovers) {
    await db.update(productTable).set({ imageUrl: nextUrl, galleryJson: JSON.stringify([nextUrl]), updatedAt: new Date().toISOString() }).where(and(eq(productTable.slug, slug), eq(productTable.imageUrl, previousUrl)));
  }

  const existingProducts = await db.select({ id: productTable.id }).from(productTable).limit(1);
  if (!existingProducts.length) {
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
        soldCount: product.soldCount ?? 0,
        paymentMode: product.paymentMode ?? "prepaid",
        badge: product.badge,
        rating: product.rating,
        reviewCount: product.reviewCount,
        isFeatured: product.isFeatured,
        isPublished: product.isPublished,
        isTestData: product.isTestData,
        })),
      )
      .onConflictDoNothing();
  }

  const existingReviews = await db.select({ id: reviewTable.id }).from(reviewTable).limit(1);
  if (seedReviews.length && !existingReviews.length && !existingProducts.length) {
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
  }

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
    soldCount: row.soldCount,
    paymentMode: row.paymentMode === "cash_on_delivery" ? "cash_on_delivery" : "prepaid",
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
    const [rows, publicReviews] = await Promise.all([
      db.select().from(productTable).orderBy(asc(productTable.id)),
      db.select().from(reviewTable),
    ]);
    const reviewStats = new Map<string, { count: number; total: number }>();
    for (const review of publicReviews) {
      if (review.status !== "approved" || review.isTestData) continue;
      const current = reviewStats.get(review.productSlug) ?? { count: 0, total: 0 };
      reviewStats.set(review.productSlug, { count: current.count + 1, total: current.total + review.rating });
    }
    const query = options?.query?.trim().toLowerCase();
    return rows
      .map((row) => {
        const product = mapProduct(row);
        const stats = reviewStats.get(product.slug);
        return { ...product, reviewCount: stats?.count ?? 0, rating: stats ? Math.round(stats.total / stats.count * 10) : 0 };
      })
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
    return seedProducts.map((product) => ({ ...product, rating: 0, reviewCount: 0, soldCount: product.soldCount ?? 0, paymentMode: product.paymentMode ?? "prepaid" }))
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
    const [[row], productReviews] = await Promise.all([
      db.select().from(productTable).where(eq(productTable.slug, slug)).limit(1),
      db.select().from(reviewTable).where(eq(reviewTable.productSlug, slug)),
    ]);
    if (!row) return null;
    const publicReviews = productReviews.filter((review) => review.status === "approved" && !review.isTestData);
    const product = mapProduct(row);
    return { ...product, reviewCount: publicReviews.length, rating: publicReviews.length ? Math.round(publicReviews.reduce((sum, review) => sum + review.rating, 0) / publicReviews.length * 10) : 0 };
  } catch {
    const product = seedProducts.find((item) => item.slug === slug);
    return product ? { ...product, rating: 0, reviewCount: 0 } : null;
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
      .filter((review) => review.status === "approved" && !review.isTestData)
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
    return [];
  }
}

export async function getPublicReviews(limit = 3): Promise<Review[]> {
  try {
    await ensureSeedData();
    const rows = await getDb().select().from(reviewTable).orderBy(desc(reviewTable.id));
    return rows
      .filter((review) => review.status === "approved" && !review.isTestData)
      .slice(0, limit)
      .map((review) => ({ id: review.id, productSlug: review.productSlug, reviewerName: review.reviewerName, rating: review.rating, title: review.title, body: review.body, status: review.status, isTestData: false }));
  } catch {
    return [];
  }
}

export async function getAdminReviews(): Promise<Review[]> {
  await ensureSeedData();
  const rows = await getDb().select().from(reviewTable).orderBy(desc(reviewTable.id));
  return rows.filter((review) => !review.isTestData).map((review) => ({
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
