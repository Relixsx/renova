import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../db";
import { orders } from "../../db/schema";

function runtimeValue(name: string) {
  return (env as unknown as Record<string, string | undefined>)[name]?.trim();
}
function escapeHtml(value: unknown) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!); }

export function paystackSecret() { return runtimeValue("PAYSTACK_SECRET_KEY"); }

async function notifyOwner(order: typeof orders.$inferSelect) {
  const endpoint = runtimeValue("FORMSPREE_ENDPOINT");
  if (!endpoint) return;
  await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      _subject: `Paid Renova order ${order.orderNumber}`,
      order_number: order.orderNumber,
      payment_status: "PAID",
      amount_ngn: order.totalKobo / 100,
      customer_name: order.customerName,
      customer_email: order.customerEmail,
      customer_phone: order.customerPhone,
      items: JSON.parse(order.itemsJson),
      delivery_address: JSON.parse(order.addressJson),
      delivery_method: JSON.parse(order.shippingJson),
      placed_at: order.createdAt,
    }),
  });
}

async function notifyCustomer(order: typeof orders.$inferSelect) {
  const apiKey = runtimeValue("RESEND_API_KEY");
  const from = runtimeValue("ORDER_FROM_EMAIL");
  if (!apiKey || !from || order.customerNotifiedAt) return false;
  const items = JSON.parse(order.itemsJson || "[]") as Array<{ name?: string; quantity?: number; variant?: string }>;
  const address = JSON.parse(order.addressJson || "{}") as Record<string, unknown>;
  const shipping = JSON.parse(order.shippingJson || "{}") as Record<string, unknown>;
  const lines = items.map((item) => `<li>${escapeHtml(item.name)} × ${Number(item.quantity ?? 1)}${item.variant ? ` — ${escapeHtml(item.variant)}` : ""}</li>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;color:#2b1812;max-width:620px;margin:auto"><h1 style="color:#e85b3f">Payment confirmed</h1><p>Hello ${escapeHtml(order.customerName)}, your Renova order has been received and payment verified.</p><h2>Order ${escapeHtml(order.orderNumber)}</h2><ul>${lines}</ul><p><b>Amount paid:</b> ₦${(order.totalKobo / 100).toLocaleString("en-NG")}</p><p><b>Delivery address:</b> ${[address.streetAddress, address.town, address.localGovernment, address.state].filter(Boolean).map(escapeHtml).join(", ")}</p><p><b>Carrier:</b> ${escapeHtml(shipping.name ?? shipping.carrier ?? "Renova delivery partner")}<br><b>Estimated delivery:</b> ${escapeHtml(order.estimatedDelivery ?? "3–5 working days")}</p><p>Track the order using <b>${escapeHtml(order.orderNumber)}</b> and this email address on the Renova tracking page.</p><p>Delivery instruction: ${escapeHtml(address.deliveryInstruction ?? "None provided")}</p><p>Questions? Email <a href="mailto:airebirth5@gmail.com">airebirth5@gmail.com</a>.</p></div>`;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [order.customerEmail], subject: `Renova order ${order.orderNumber} confirmed`, html }) });
  return response.ok;
}

export async function markOrderPaid(reference: string, paidAmountKobo: number) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, reference)).limit(1);
  if (!order) throw new Error("Order not found.");
  if (paidAmountKobo !== order.totalKobo) throw new Error("Payment amount does not match the order total.");
  if (order.paymentStatus === "paid") return order;
  const [updated] = await db.update(orders).set({ paymentStatus: "paid", status: "processing", estimatedDelivery: order.estimatedDelivery ?? "3–5 working days", updatedAt: new Date().toISOString() }).where(eq(orders.id, order.id)).returning();
  await Promise.allSettled([notifyOwner(updated), notifyCustomer(updated).then(async (sent) => { if (sent) await db.update(orders).set({ customerNotifiedAt: new Date().toISOString() }).where(eq(orders.id, updated.id)); })]);
  return updated;
}
