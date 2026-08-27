import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { products, reviews } from "../../../db/schema";
import { requireOwnerRequest } from "../../lib/admin-auth";
import { ensureSeedData } from "../../lib/server-catalog";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function asKobo(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100)
    : null;
}

const detailFields = [
  "brand",
  "model",
  "materials",
  "dimensions",
  "weight",
  "colour",
  "size",
  "warranty",
  "packageContents",
  "countryOfOrigin",
  "careInstructions",
  "compatibility",
  "chatbotKnowledge",
] as const;
function textValue(
  payload: Record<string, unknown>,
  key: (typeof detailFields)[number],
) {
  return String(payload[key] ?? "").trim();
}
function parseSpecifications(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, string>;
  return Object.fromEntries(
    String(value ?? "")
      .split("\n")
      .map((line) => line.split(":"))
      .filter((parts) => parts.length > 1)
      .map(([key, ...rest]) => [key.trim(), rest.join(":").trim()])
      .filter(([key, value]) => key && value),
  );
}
function parseFaq(value: unknown) {
  if (Array.isArray(value)) return value;
  return String(value ?? "")
    .split("\n")
    .map((line) => line.split("|"))
    .filter((parts) => parts.length > 1)
    .map(([question, ...answer]) => ({
      question: question.trim(),
      answer: answer.join("|").trim(),
    }))
    .filter((item) => item.question && item.answer);
}

export async function GET(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  try {
    await ensureSeedData();
    const db = getDb();
    const rows = await db.select().from(products).orderBy(desc(products.id));
    return Response.json({ products: rows });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load products.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const name = String(payload.name ?? "").trim();
    const categorySlug = String(payload.categorySlug ?? "").trim();
    const priceKobo = asKobo(payload.priceNaira);
    const compareAtKobo = payload.compareAtNaira
      ? asKobo(payload.compareAtNaira)
      : null;
    const supplierCostKobo = payload.supplierCostNaira
      ? asKobo(payload.supplierCostNaira)
      : null;
    const imageUrl = String(payload.imageUrl ?? "").trim();
    const stock = Math.max(0, Math.floor(Number(payload.stock ?? 0)));
    const soldCount = Math.max(0, Math.floor(Number(payload.soldCount ?? 0)));
    const paymentMode =
      payload.paymentMode === "cash_on_delivery"
        ? "cash_on_delivery"
        : "prepaid";
    const variants = Array.isArray(payload.variants)
      ? payload.variants
          .map(String)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    if (!name || !categorySlug || priceKobo === null || !imageUrl) {
      return Response.json(
        {
          error:
            "Product name, category, selling price and image are required.",
        },
        { status: 400 },
      );
    }

    await ensureSeedData();
    const db = getDb();
    const baseSlug = slugify(String(payload.slug ?? name));
    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 5)}`;
    const sku =
      String(payload.sku ?? "").trim() ||
      `REN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const [created] = await db
      .insert(products)
      .values({
        name,
        slug,
        sku,
        categorySlug,
        shortDescription: String(payload.shortDescription ?? "").trim(),
        description: String(payload.description ?? "").trim(),
        priceKobo,
        compareAtKobo,
        supplierCostKobo,
        imageUrl,
        galleryJson: JSON.stringify(
          Array.isArray(payload.gallery) && payload.gallery.length
            ? payload.gallery
            : [imageUrl],
        ),
        variantsJson: JSON.stringify(variants.length ? variants : ["Standard"]),
        specificationsJson: JSON.stringify(
          parseSpecifications(payload.specifications),
        ),
        chatbotFaqJson: JSON.stringify(parseFaq(payload.chatbotFaq)),
        ...Object.fromEntries(
          detailFields.map((key) => [key, textValue(payload, key)]),
        ),
        stock,
        soldCount,
        paymentMode,
        badge: String(payload.badge ?? "").trim() || null,
        isFeatured: Boolean(payload.isFeatured),
        isPublished: Boolean(payload.isPublished),
        isTestData: true,
        supplierName: String(payload.supplierName ?? "").trim() || null,
        supplierUrl: String(payload.supplierUrl ?? "").trim() || null,
        pageTemplate:
          payload.pageTemplate === "flexible" ? "flexible" : "standard",
        landingPageJson: JSON.stringify(
          payload.landingPage && typeof payload.landingPage === "object"
            ? payload.landingPage
            : {},
        ),
      })
      .returning();

    return Response.json({ product: created }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the product.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  try {
    const payload = (await request.json()) as Record<string, unknown> & {
      id?: number;
    };
    if (!payload.id)
      return Response.json(
        { error: "Product id is required." },
        { status: 400 },
      );
    const db = getDb();
    const updates: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (payload.name !== undefined) updates.name = String(payload.name).trim();
    if (payload.sku !== undefined) updates.sku = String(payload.sku).trim();
    if (payload.categorySlug !== undefined)
      updates.categorySlug = String(payload.categorySlug).trim();
    if (payload.shortDescription !== undefined)
      updates.shortDescription = String(payload.shortDescription).trim();
    if (payload.description !== undefined)
      updates.description = String(payload.description).trim();
    if (payload.priceNaira !== undefined) {
      const value = asKobo(payload.priceNaira);
      if (value === null)
        return Response.json(
          { error: "Enter a valid selling price." },
          { status: 400 },
        );
      updates.priceKobo = value;
    }
    if (payload.compareAtNaira !== undefined)
      updates.compareAtKobo = payload.compareAtNaira
        ? asKobo(payload.compareAtNaira)
        : null;
    if (payload.supplierCostNaira !== undefined)
      updates.supplierCostKobo = payload.supplierCostNaira
        ? asKobo(payload.supplierCostNaira)
        : null;
    if (payload.imageUrl !== undefined)
      updates.imageUrl = String(payload.imageUrl).trim();
    if (payload.gallery !== undefined)
      updates.galleryJson = JSON.stringify(
        Array.isArray(payload.gallery) ? payload.gallery : [],
      );
    if (payload.variants !== undefined)
      updates.variantsJson = JSON.stringify(
        Array.isArray(payload.variants) ? payload.variants : [],
      );
    if (payload.specifications !== undefined)
      updates.specificationsJson = JSON.stringify(
        parseSpecifications(payload.specifications),
      );
    if (payload.chatbotFaq !== undefined)
      updates.chatbotFaqJson = JSON.stringify(parseFaq(payload.chatbotFaq));
    for (const key of detailFields)
      if (payload[key] !== undefined) updates[key] = textValue(payload, key);
    if (payload.stock !== undefined)
      updates.stock = Math.max(0, Math.floor(Number(payload.stock)));
    if (payload.soldCount !== undefined)
      updates.soldCount = Math.max(0, Math.floor(Number(payload.soldCount)));
    if (payload.paymentMode !== undefined)
      updates.paymentMode =
        payload.paymentMode === "cash_on_delivery"
          ? "cash_on_delivery"
          : "prepaid";
    if (payload.badge !== undefined)
      updates.badge = String(payload.badge).trim() || null;
    if (payload.supplierName !== undefined)
      updates.supplierName = String(payload.supplierName).trim() || null;
    if (payload.supplierUrl !== undefined)
      updates.supplierUrl = String(payload.supplierUrl).trim() || null;
    if (payload.pageTemplate !== undefined)
      updates.pageTemplate =
        payload.pageTemplate === "flexible" ? "flexible" : "standard";
    if (payload.landingPage !== undefined)
      updates.landingPageJson = JSON.stringify(
        payload.landingPage && typeof payload.landingPage === "object"
          ? payload.landingPage
          : {},
      );
    if (typeof payload.isPublished === "boolean")
      updates.isPublished = payload.isPublished;
    if (typeof payload.isFeatured === "boolean")
      updates.isFeatured = payload.isFeatured;
    const [updated] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, payload.id))
      .returning();
    if (!updated)
      return Response.json({ error: "Product not found." }, { status: 404 });
    return Response.json({ product: updated });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the product.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0)
      return Response.json(
        { error: "A valid product id is required." },
        { status: 400 },
      );
    const db = getDb();
    const [existing] = await db
      .select({ id: products.id, slug: products.slug, name: products.name })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!existing)
      return Response.json({ error: "Product not found." }, { status: 404 });
    await db.transaction(async (transaction) => {
      await transaction
        .delete(reviews)
        .where(eq(reviews.productSlug, existing.slug));
      await transaction.delete(products).where(eq(products.id, existing.id));
    });
    return Response.json({ deleted: existing });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not delete the product.",
      },
      { status: 500 },
    );
  }
}
