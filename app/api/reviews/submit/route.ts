import { getDb } from "../../../../db";
import { reviews } from "../../../../db/schema";
import { ensureSeedData } from "../../../lib/server-catalog";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const productSlug = String(payload.productSlug ?? "").trim();
    const reviewerName = String(payload.reviewerName ?? "").trim();
    const rating = Math.max(1, Math.min(5, Math.round(Number(payload.rating ?? 5))));
    const title = String(payload.title ?? "").trim();
    const body = String(payload.body ?? "").trim();
    if (!productSlug || !reviewerName || !title || body.length < 10) return Response.json({ error: "Complete every review field." }, { status: 400 });
    await ensureSeedData();
    await getDb().insert(reviews).values({ productSlug, reviewerName, rating, title, body, status: "pending", isTestData: false, isVerifiedPurchase: false, reviewedAt: new Date().toISOString() });
    return Response.json({ submitted: true, message: "Thank you. Your review will appear after moderation." }, { status: 201 });
  } catch {
    return Response.json({ error: "This review could not be submitted. It may already exist." }, { status: 400 });
  }
}
