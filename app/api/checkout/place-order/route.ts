import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { getDeliveryOption } from "../../../lib/checkout";
import { sendOrderNotifications } from "../../../lib/order-payment";
import { getProduct } from "../../../lib/server-catalog";

type CartLine = { slug: string; quantity: number; variant?: string };

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { lines?: CartLine[]; details?: Record<string, string>; deliveryId?: string; customerConfirmedDeliveryCommitment?: boolean };
    const details = payload.details ?? {};
    const delivery = getDeliveryOption(String(payload.deliveryId ?? ""));
    if (!delivery || !payload.lines?.length) return Response.json({ error: "Your cart or delivery selection is incomplete." }, { status: 400 });
    if (payload.customerConfirmedDeliveryCommitment !== true) return Response.json({ error: "Confirm that you intend to receive and pay for this order at delivery." }, { status: 400 });
    if (!details.fullName || !details.email || !details.phone || !details.streetAddress || !details.stateCode || !details.lga || !details.cityTown) return Response.json({ error: "Complete the delivery address before placing the order." }, { status: 400 });

    const verifiedItems = [];
    let subtotalKobo = 0;
    for (const line of payload.lines) {
      const product = await getProduct(line.slug);
      const quantity = Math.max(1, Math.min(10, Math.floor(Number(line.quantity))));
      if (!product || !product.isPublished || product.stock < quantity) return Response.json({ error: `${product?.name ?? "A product"} is no longer available in the requested quantity.` }, { status: 409 });
      if (product.paymentMode !== "cash_on_delivery") return Response.json({ error: `${product.name} requires prepaid Paystack checkout.` }, { status: 409 });
      subtotalKobo += product.priceKobo * quantity;
      verifiedItems.push({ slug: product.slug, name: product.name, sku: product.sku, variant: String(line.variant ?? product.variants[0] ?? "Standard"), quantity, unitPriceKobo: product.priceKobo, imageUrl: product.imageUrl });
    }

    const totalKobo = subtotalKobo + delivery.priceKobo;
    const orderNumber = `REN-COD-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
    const [created] = await getDb().insert(orders).values({
      orderNumber,
      customerName: details.fullName,
      customerEmail: details.email,
      customerPhone: details.phone,
      status: "confirmed",
      paymentStatus: "payment_due_on_delivery",
      paymentMethod: "cash_on_delivery",
      totalKobo,
      itemsJson: JSON.stringify(verifiedItems),
      addressJson: JSON.stringify(details),
      shippingJson: JSON.stringify(delivery),
      trackingNumber: orderNumber,
      estimatedDelivery: "3–5 working days",
    }).returning();
    await sendOrderNotifications(created);
    return Response.json({ orderNumber });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The order could not be placed." }, { status: 500 });
  }
}
