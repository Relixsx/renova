import { withStoreWriter } from "../../../lib/store-writer";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders, products } from "../../../../db/schema";
import { ANAGEN } from "../../../lib/anagen-offer.mjs";
import { AnagenOrderError, digestAnagenValue, validateAnagenOrder } from "../../../lib/anagen-order";
import { sendOrderNotifications } from "../../../lib/order-payment";

export async function POST(request: Request) {
  return withStoreWriter(request, async () => {
  try {
    const origin = request.headers.get("origin");
    const allowedOrigins = [new URL(request.url).origin];
    try { if (process.env.APP_URL) allowedOrigins.push(new URL(process.env.APP_URL).origin); } catch { /* Request origin still applies. */ }
    if (origin && !allowedOrigins.includes(origin)) throw new AnagenOrderError("Submit your order from the Renova Anagen page.", 403);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 16000) throw new AnagenOrderError("Your order details are too long.", 413);
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { throw new AnagenOrderError("Check your order details."); }
    const { key, bundle, details, consent } = validateAnagenOrder(payload);
    const orderNumber = `REN-ANA-${(await digestAnagenValue(key)).slice(0, 24).toUpperCase()}`;
    const fingerprint = await digestAnagenValue(JSON.stringify({ packs: bundle.packs, details }));
    const db = getDb();
    const [existing] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    const responseForExisting = (order: typeof orders.$inferSelect) => {
      let saved: Record<string, unknown> = {};
      try { saved = JSON.parse(order.addressJson); } catch { /* Reject an unrelated record. */ }
      if (saved.anagenRequestFingerprint !== fingerprint) throw new AnagenOrderError("Your previous order was already received with different details. Check your confirmation before creating a separate order.", 409, "REFERENCE_USED");
      return Response.json({ orderNumber: order.orderNumber, totalKobo: order.totalKobo, packs: bundle.packs, alreadyReceived: true });
    };
    if (existing) return responseForExisting(existing);
    const [product] = await db.select().from(products).where(eq(products.slug, ANAGEN.slug)).limit(1);
    if (!product || product.sku !== ANAGEN.sku || !product.isPublished || product.paymentMode !== "cash_on_delivery" || product.priceKobo !== ANAGEN.bundles[0].totalKobo) {
      throw new AnagenOrderError("Anagen ordering is temporarily unavailable. Please contact Renova.", 409);
    }
    // Use the store's existing catalogue availability workflow; count packs,
    // rather than treating a three-pack bundle as one available pack.
    if (product.stock < bundle.packs) throw new AnagenOrderError("That pack quantity is currently unavailable. Choose a smaller bundle or contact Renova.", 409);
    const item = {
      slug: product.slug, sku: product.sku,
      name: `${product.name} — ${bundle.label}`,
      variant: `${bundle.packs * 2} sachets · ${bundle.label}`,
      quantity: 1, packQuantity: bundle.packs,
      // A bundle is one priced line. This keeps ₦28,600 exact without a
      // fractional per-pack kobo value or a misleading 3 × ₦11,200 total.
      unitPriceKobo: bundle.totalKobo, imageUrl: product.imageUrl,
    };
    const [created] = await db.insert(orders).values({
      orderNumber, customerName: details.fullName, customerEmail: details.email,
      customerPhone: details.phone, ...consent,
      status: "confirmed", paymentStatus: "payment_due_on_delivery", paymentMethod: "cash_on_delivery",
      totalKobo: bundle.totalKobo, itemsJson: JSON.stringify([item]),
      addressJson: JSON.stringify({ ...details, anagenRequestFingerprint: fingerprint }),
      shippingJson: JSON.stringify({ id: "anagen-doorstep", name: ANAGEN.shippingName, priceKobo: 0, label: "Free delivery", detail: ANAGEN.estimate }),
      estimatedDelivery: ANAGEN.estimate, trackingNumber: orderNumber,
    }).onConflictDoNothing({ target: orders.orderNumber }).returning();
    if (!created) {
      const [saved] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
      if (!saved) throw new Error("Order result unavailable after duplicate submission.");
      return responseForExisting(saved);
    }
    await sendOrderNotifications(created);
    return Response.json({ orderNumber, totalKobo: created.totalKobo, packs: bundle.packs, alreadyReceived: false }, { status: 201 });
  } catch (error) {
    if (error instanceof AnagenOrderError) return Response.json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status });
    console.error("Anagen checkout could not complete.");
    return Response.json({ error: "We could not confirm the result. Please retry with the same details; your order reference prevents duplicate orders." }, { status: 503 });
  }

  });
}
