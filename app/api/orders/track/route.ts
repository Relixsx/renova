import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { orderNumber?: string; email?: string };
    const orderNumber = String(body.orderNumber ?? "").trim().toUpperCase();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^REN-[A-Z0-9-]{6,30}$/.test(orderNumber) || !email.includes("@")) return Response.json({ error: "Enter a valid order number and email address." }, { status: 400 });
    const [order] = await getDb().select().from(orders).where(and(eq(orders.orderNumber, orderNumber), sql`lower(${orders.customerEmail}) = ${email}`)).limit(1);
    if (!order) return Response.json({ error: "We could not match those order details." }, { status: 404 });
    const shipping = JSON.parse(order.shippingJson || "{}") as Record<string, unknown>;
    return Response.json({ order: { orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus, carrier: String(shipping.name ?? shipping.carrier ?? "Renova delivery partner"), trackingNumber: order.trackingNumber, estimatedDelivery: order.estimatedDelivery ?? "3–5 working days", createdAt: order.createdAt } });
  } catch { return Response.json({ error: "Order tracking is temporarily unavailable." }, { status: 500 }); }
}
