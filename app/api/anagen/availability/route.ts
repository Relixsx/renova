import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "../../../../db";
import { products } from "../../../../db/schema";
import { availableAnagenStock } from "../../../lib/anagen-catalogue";
import { ANAGEN } from "../../../lib/anagen-offer.mjs";

const getBundleCapacity = unstable_cache(async () => {
  const [product] = await getDb().select({
    stock: products.stock,
    sku: products.sku,
    isPublished: products.isPublished,
    paymentMode: products.paymentMode,
    priceKobo: products.priceKobo,
  }).from(products).where(eq(products.slug, ANAGEN.slug)).limit(1);
  const stock = availableAnagenStock(product);
  return stock === null ? null : Math.min(stock, ANAGEN.bundles.length);
}, ["anagen-bundle-capacity"], { revalidate: 45 });

export async function GET() {
  try {
    return Response.json({ capacity: await getBundleCapacity() });
  } catch {
    // Checkout still verifies the current catalogue when the read cache is unavailable.
    return Response.json({ capacity: undefined }, { status: 503 });
  }
}
