import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { getDeliveryOption } from "../../../lib/checkout";
import { paystackSecret } from "../../../lib/order-payment";
import { getProduct } from "../../../lib/server-catalog";

type CartLine = { slug: string; quantity: number; variant?: string };

export async function POST(request: Request) {
  try {
    const secret = paystackSecret();
    if (!secret) return Response.json({ error: "Live Paystack checkout is waiting for the store owner’s secret key." }, { status: 503 });
    const payload = (await request.json()) as { lines?: CartLine[]; details?: Record<string, string>; deliveryId?: string };
    const details = payload.details ?? {};
    const delivery = getDeliveryOption(String(payload.deliveryId ?? ""));
    if (!delivery || !payload.lines?.length) return Response.json({ error: "Your cart or delivery selection is incomplete." }, { status: 400 });
    if (!details.fullName || !details.email || !details.phone || !details.streetAddress || !details.stateCode || !details.lga || !details.cityTown) return Response.json({ error: "Complete the delivery address before payment." }, { status: 400 });

    const verifiedItems = [];
    let subtotalKobo = 0;
    for (const line of payload.lines) {
      const product = await getProduct(line.slug);
      const quantity = Math.max(1, Math.min(10, Math.floor(Number(line.quantity))));
      if (!product || !product.isPublished || product.stock < quantity) return Response.json({ error: `${product?.name ?? "A product"} is no longer available in the requested quantity.` }, { status: 409 });
      subtotalKobo += product.priceKobo * quantity;
      verifiedItems.push({ slug: product.slug, name: product.name, sku: product.sku, variant: String(line.variant ?? product.variants[0] ?? "Standard"), quantity, unitPriceKobo: product.priceKobo, imageUrl: product.imageUrl });
    }
    const totalKobo = subtotalKobo + delivery.priceKobo;
    const orderNumber = `REN-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
    await getDb().insert(orders).values({ orderNumber, customerName: details.fullName, customerEmail: details.email, customerPhone: details.phone, totalKobo, itemsJson: JSON.stringify(verifiedItems), addressJson: JSON.stringify(details), shippingJson: JSON.stringify(delivery) });

    const requestOrigin = new URL(request.url).origin;
    const origin = (process.env.APP_URL?.trim() || requestOrigin).replace(/\/$/, "");
    if (!/^https?:\/\//i.test(origin)) return Response.json({ error: "APP_URL must be a complete http(s) URL." }, { status: 500 });
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ email: details.email, amount: totalKobo, currency: "NGN", reference: orderNumber, callback_url: `${origin}/api/paystack/verify?reference=${encodeURIComponent(orderNumber)}`, metadata: { order_number: orderNumber, customer_name: details.fullName } }),
    });
    const paystackPayload = await paystackResponse.json() as { status?: boolean; message?: string; data?: { authorization_url?: string } };
    if (!paystackResponse.ok || !paystackPayload.status || !paystackPayload.data?.authorization_url) return Response.json({ error: paystackPayload.message || "Paystack could not start this payment." }, { status: 502 });
    return Response.json({ authorizationUrl: paystackPayload.data.authorization_url, orderNumber });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Checkout could not be started." }, { status: 500 });
  }
}
