import { standardDeliveryEstimate } from "../../../lib/delivery-estimate";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { phoneForWhatsApp } from "../../../lib/whatsapp-message";
import { ANAGEN } from "../../../lib/anagen-offer.mjs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { orderNumber?: string; email?: string; phone?: string };
    const orderNumber = String(body.orderNumber ?? "").trim().toUpperCase();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^REN-[A-Z0-9-]{6,30}$/.test(orderNumber)) return Response.json({ error: "Enter a valid order number and matching contact detail." }, { status: 400 });
    let phone = "";
    if (!email) {
      try { phone = phoneForWhatsApp(String(body.phone ?? "")); }
      catch { return Response.json({ error: "Enter your checkout email, or your delivery phone for an Anagen order placed without email." }, { status: 400 }); }
    } else if (!email.includes("@")) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    // Email-based tracking is unchanged. Phone lookup is limited to Anagen
    // orders that were genuinely placed without an email address.
    const contact = email ? sql`lower(${orders.customerEmail}) = ${email}` : and(eq(orders.customerEmail, ""), eq(orders.customerPhone, phone));
    const [order] = await getDb().select().from(orders).where(and(eq(orders.orderNumber, orderNumber), contact)).limit(1);
    if (!order) return Response.json({ error: "We could not match those order details." }, { status: 404 });
    if (phone) {
      let source = "";
      try { source = JSON.parse(order.addressJson).orderSource; } catch { /* Keep unrelated orders private. */ }
      if (!orderNumber.startsWith("REN-ANA-") || source !== ANAGEN.version) return Response.json({ error: "We could not match those order details." }, { status: 404 });
    }
    const shipping = JSON.parse(order.shippingJson || "{}") as Record<string, unknown>;
    return Response.json({ order: { orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus, carrier: String(shipping.name ?? shipping.carrier ?? "Renova delivery partner"), trackingNumber: order.trackingNumber, estimatedDelivery: standardDeliveryEstimate(order.estimatedDelivery, order.addressJson), createdAt: order.createdAt } });
  } catch { return Response.json({ error: "Order tracking is temporarily unavailable." }, { status: 500 }); }
}
