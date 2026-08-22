import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { products, reviews } from "../../../db/schema";
import { requireOwnerRequest } from "../../lib/admin-auth";
import { ensureSeedData } from "../../lib/server-catalog";

async function refreshProductRating(productSlug: string) {
  const db = getDb();
  const rows = await db.select().from(reviews).where(eq(reviews.productSlug, productSlug));
  const approved = rows.filter((review) => review.status === "approved");
  const rating = approved.length ? Math.round((approved.reduce((sum, review) => sum + review.rating, 0) / approved.length) * 10) : 0;
  await db.update(products).set({ rating, reviewCount: approved.length, updatedAt: new Date().toISOString() }).where(eq(products.slug, productSlug));
}

export async function GET(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  await ensureSeedData();
  const rows = await getDb().select().from(reviews).orderBy(desc(reviews.id));
  return Response.json({ reviews: rows });
}

export async function POST(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const productSlug = String(payload.productSlug ?? "").trim();
    const reviewerName = String(payload.reviewerName ?? "").trim();
    const rating = Math.max(1, Math.min(5, Math.round(Number(payload.rating ?? 5))));
    const title = String(payload.title ?? "").trim();
    const body = String(payload.body ?? "").trim();
    if (!productSlug || !reviewerName || !title || !body) return Response.json({ error: "Product, reviewer, title and review are required." }, { status: 400 });
    await ensureSeedData();
    const [created] = await getDb().insert(reviews).values({
      productSlug,
      reviewerName,
      rating,
      title,
      body,
      status: "approved",
      isTestData: Boolean(payload.isTestData),
    }).returning();
    await refreshProductRating(productSlug);
    return Response.json({ review: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not add the review." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return Response.json({ error: "Review id is required." }, { status: 400 });
  const db = getDb();
  const [existing] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  if (!existing) return Response.json({ error: "Review not found." }, { status: 404 });
  await db.delete(reviews).where(eq(reviews.id, id));
  await refreshProductRating(existing.productSlug);
  return Response.json({ deleted: true });
}
