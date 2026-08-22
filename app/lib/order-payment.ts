import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { orders } from "../../db/schema";

function runtimeValue(name: string) {
  return process.env[name]?.trim();
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
  if (order.customerNotifiedAt) return true;
  if (!apiKey || !from) {
    console.error("Customer confirmation email is not configured. Set RESEND_API_KEY and ORDER_FROM_EMAIL.");
    return false;
  }
  const items = JSON.parse(order.itemsJson || "[]") as Array<{ name?: string; quantity?: number; variant?: string }>;
  const address = JSON.parse(order.addressJson || "{}") as Record<string, unknown>;
  const shipping = JSON.parse(order.shippingJson || "{}") as Record<string, unknown>;
  const lines = items.map((item) => `<li>${escapeHtml(item.name)} × ${Number(item.quantity ?? 1)}${item.variant ? ` — ${escapeHtml(item.variant)}` : ""}</li>`).join("");
  const appUrl = (runtimeValue("APP_URL") ?? "").replace(/\/$/, "");
  const trackingUrl = appUrl ? `${appUrl}/track-order` : "";
  const deliveryAddress = [address.streetAddress, address.addressLineTwo, address.cityTown, address.lga, address.stateCode, "Nigeria"].filter(Boolean).map(escapeHtml).join(", ");
  const html = `<div style="margin:0;background:#f6eee3;padding:32px 16px;font-family:Arial,sans-serif;color:#2b1812"><div style="max-width:640px;margin:auto;background:#fffaf2;border:1px solid #e2d3c4"><div style="padding:30px;background:#2b1812;color:#fff"><div style="color:#f06a43;font-size:13px;font-weight:700;letter-spacing:3px">RENOVA</div><h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:34px;font-weight:400">Your payment is confirmed.</h1></div><div style="padding:30px"><p>Hello ${escapeHtml(order.customerName)},</p><p>Thank you for shopping with Renova. We have received your order and securely verified your payment.</p><div style="margin:24px 0;padding:20px;background:#f6eee3"><div style="font-size:12px;color:#806d63">ORDER NUMBER</div><div style="margin-top:5px;font-size:22px;font-weight:700">${escapeHtml(order.orderNumber)}</div></div><h2 style="font-family:Georgia,serif;font-weight:400">Order details</h2><ul style="padding-left:20px;line-height:1.8">${lines}</ul><p><b>Amount paid:</b> ₦${(order.totalKobo / 100).toLocaleString("en-NG")}</p><p><b>Delivery address:</b> ${deliveryAddress}</p><p><b>Delivery partner:</b> ${escapeHtml(shipping.name ?? shipping.carrier ?? "Renova delivery partner")}<br><b>Estimated delivery:</b> ${escapeHtml(order.estimatedDelivery ?? "3–5 working days")}</p><p><b>Delivery instructions:</b> ${escapeHtml(address.deliveryInstructions ?? "None provided")}</p>${trackingUrl ? `<p style="margin:28px 0"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:14px 22px;background:#e95e3c;color:#fff;text-decoration:none;font-weight:700">Track your order</a></p>` : ""}<p>Use order number <b>${escapeHtml(order.orderNumber)}</b> and <b>${escapeHtml(order.customerEmail)}</b> when tracking.</p><p style="margin-top:28px;color:#806d63;font-size:13px">Need help? Email <a href="mailto:airebirth5@gmail.com" style="color:#2b1812">airebirth5@gmail.com</a>.</p></div></div></div>`;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [order.customerEmail], subject: `Renova order ${order.orderNumber} confirmed`, html }) });
  if (!response.ok) console.error("Customer confirmation email failed:", response.status, await response.text());
  return response.ok;
}

async function deliverPaidNotifications(order: typeof orders.$inferSelect, notifyStoreOwner: boolean) {
  const db = getDb();
  const tasks: Promise<unknown>[] = [];
  if (notifyStoreOwner) tasks.push(notifyOwner(order));
  if (!order.customerNotifiedAt) {
    tasks.push(notifyCustomer(order).then(async (sent) => {
      if (sent) await db.update(orders).set({ customerNotifiedAt: new Date().toISOString() }).where(eq(orders.id, order.id));
    }));
  }
  await Promise.allSettled(tasks);
}

export async function markOrderPaid(reference: string, paidAmountKobo: number) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, reference)).limit(1);
  if (!order) throw new Error("Order not found.");
  if (paidAmountKobo !== order.totalKobo) throw new Error("Payment amount does not match the order total.");
  if (order.paymentStatus === "paid") {
    await deliverPaidNotifications(order, false);
    return order;
  }
  const [updated] = await db.update(orders).set({ paymentStatus: "paid", status: "processing", estimatedDelivery: order.estimatedDelivery ?? "3–5 working days", updatedAt: new Date().toISOString() }).where(eq(orders.id, order.id)).returning();
  await deliverPaidNotifications(updated, true);
  return updated;
}
