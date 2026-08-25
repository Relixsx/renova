import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { orders, products } from "../../db/schema";

function runtimeValue(name: string) {
  return process.env[name]?.trim();
}
function escapeHtml(value: unknown) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!); }

export function paystackSecret() { return runtimeValue("PAYSTACK_SECRET_KEY"); }

async function notifyOwner(order: typeof orders.$inferSelect) {
  const endpoint = runtimeValue("FORMSPREE_ENDPOINT");
  if (!endpoint) {
    console.warn("FORMSPREE_ENDPOINT is not configured; owner notification skipped.");
    return false;
  }
  const items = JSON.parse(order.itemsJson || "[]") as Array<{ name?: string; quantity?: number; variant?: string }>;
  const address = JSON.parse(order.addressJson || "{}") as Record<string, unknown>;
  const productSummary = items.map((item, index) => {
    const variant = item.variant && item.variant !== "Standard" ? ` (${item.variant})` : "";
    return `${index + 1}. ${item.name || "Product"}${variant} — Quantity: ${Number(item.quantity ?? 1)}`;
  }).join("\n");
  const deliveryAddress = [
    address.streetAddress,
    address.cityTown ?? address.town,
    address.lga ?? address.localGovernment,
    address.state ?? address.stateCode,
  ].filter(Boolean).join(", ");
  const isDeliveryPayment = order.paymentMethod === "cash_on_delivery";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      _subject: `${isDeliveryPayment ? "New payment-on-delivery" : "New paid"} Renova order — ${order.orderNumber}`,
      "Order Number": order.orderNumber,
      "Tracking Number": order.trackingNumber || order.orderNumber,
      "Payment Status": isDeliveryPayment ? "Payment due on delivery" : "Paid via Paystack",
      [isDeliveryPayment ? "Amount Due" : "Amount Paid"]: `₦${(order.totalKobo / 100).toLocaleString("en-NG")}`,
      "Customer Name": order.customerName,
      "Customer Email": order.customerEmail,
      "Phone Number": order.customerPhone,
      "Product and Quantity": productSummary || "No product details available",
      "Delivery Address": deliveryAddress || "No delivery address available",
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Formspree rejected order ${order.orderNumber} (${response.status}): ${detail.slice(0, 300)}`);
  }
  return true;
}

async function notifyCustomer(order: typeof orders.$inferSelect) {
  const apiKey = runtimeValue("RESEND_API_KEY");
  // RESEND_FROM_EMAIL is the documented Render variable. Keep the old name as
  // a backwards-compatible fallback for existing installations.
  const from = runtimeValue("RESEND_FROM_EMAIL") ?? runtimeValue("ORDER_FROM_EMAIL");
  if (order.customerNotifiedAt) return false;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured; customer confirmation was not sent.");
  if (!from) throw new Error("RESEND_FROM_EMAIL is not configured; customer confirmation was not sent.");
  if (!order.customerEmail?.includes("@")) throw new Error(`Order ${order.orderNumber} has an invalid customer email address.`);
  const items = JSON.parse(order.itemsJson || "[]") as Array<{ name?: string; quantity?: number; variant?: string }>;
  const address = JSON.parse(order.addressJson || "{}") as Record<string, unknown>;
  const shipping = JSON.parse(order.shippingJson || "{}") as Record<string, unknown>;
  const appUrl = (runtimeValue("APP_URL") ?? "https://shoprenova.com.ng").replace(/\/$/, "");
  const trackUrl = `${appUrl}/track-order`;
  const deliveryAddress = [
    address.streetAddress,
    address.cityTown ?? address.town,
    address.lga ?? address.localGovernment,
    address.state ?? address.stateCode,
  ].filter(Boolean).map(escapeHtml).join(", ");
  const itemRows = items.map((item) => `<tr>
    <td style="padding:14px 0;border-bottom:1px solid #ece8e5;color:#171717;font-size:15px;line-height:1.45">${escapeHtml(item.name || "Product")}${item.variant && item.variant !== "Standard" ? `<br><span style="color:#6b6b6b;font-size:13px">${escapeHtml(item.variant)}</span>` : ""}</td>
    <td align="center" style="padding:14px 8px;border-bottom:1px solid #ece8e5;color:#171717;font-size:15px">${Number(item.quantity ?? 1)}</td>
  </tr>`).join("");
  const isDeliveryPayment = order.paymentMethod === "cash_on_delivery";
  const amount = `₦${(order.totalKobo / 100).toLocaleString("en-NG")}`;
  const messageLabel = isDeliveryPayment ? "Order confirmed" : "Payment confirmed";
  const intro = isDeliveryPayment
    ? `Hello ${escapeHtml(order.customerName)}, your payment-on-delivery order has been confirmed. Please be available to receive it and pay ${amount} when it arrives.`
    : `Hello ${escapeHtml(order.customerName)}, we have received your order and verified your payment securely through Paystack.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#171717">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e8e8e8">
      <tr><td style="padding:28px 32px;border-bottom:4px solid #ff5a2f"><div style="font-size:25px;font-weight:800;letter-spacing:4px">RENOVA</div><div style="margin-top:6px;color:#777;font-size:12px">Everyday finds, renewed.</div></td></tr>
      <tr><td style="padding:36px 32px 16px"><div style="color:#ff5a2f;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase">${messageLabel}</div><h1 style="margin:12px 0 14px;font-size:30px;line-height:1.2">Thank you. Your order is in motion.</h1><p style="margin:0;color:#555;font-size:16px;line-height:1.6">${intro}</p></td></tr>
      <tr><td style="padding:16px 32px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7f2;border-left:4px solid #ff5a2f"><tr><td style="padding:18px"><div style="color:#777;font-size:12px;text-transform:uppercase">Order number</div><div style="margin-top:5px;font-size:18px;font-weight:700">${escapeHtml(order.orderNumber)}</div></td><td align="right" style="padding:18px"><div style="color:#777;font-size:12px;text-transform:uppercase">${isDeliveryPayment ? "Amount due" : "Amount paid"}</div><div style="margin-top:5px;font-size:18px;font-weight:700">${amount}</div></td></tr></table></td></tr>
      <tr><td style="padding:12px 32px"><h2 style="margin:0 0 8px;font-size:19px">Order summary</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><th align="left" style="padding:10px 0;border-bottom:2px solid #171717;font-size:12px;text-transform:uppercase">Item</th><th align="center" style="padding:10px 8px;border-bottom:2px solid #171717;font-size:12px;text-transform:uppercase">Qty</th></tr>${itemRows}</table></td></tr>
      <tr><td style="padding:24px 32px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td valign="top" width="50%" style="padding-right:12px"><div style="font-size:12px;color:#777;text-transform:uppercase">Delivery address</div><div style="margin-top:7px;font-size:14px;line-height:1.6">${deliveryAddress || "Address recorded with your order"}</div></td><td valign="top" width="50%" style="padding-left:12px"><div style="font-size:12px;color:#777;text-transform:uppercase">Delivery</div><div style="margin-top:7px;font-size:14px;line-height:1.6"><b>${escapeHtml(shipping.name ?? shipping.carrier ?? "Renova delivery partner")}</b><br>${escapeHtml(order.estimatedDelivery ?? "3–5 working days")}</div></td></tr></table></td></tr>
      <tr><td align="center" style="padding:8px 32px 32px"><a href="${escapeHtml(trackUrl)}" style="display:inline-block;background:#ff5a2f;color:#fff;text-decoration:none;font-size:14px;font-weight:800;padding:15px 28px">TRACK YOUR ORDER</a><p style="margin:18px 0 0;color:#666;font-size:13px;line-height:1.5">Use order number <b>${escapeHtml(order.orderNumber)}</b> and the email address used at checkout.</p></td></tr>
      <tr><td style="padding:22px 32px;background:#171717;color:#fff;font-size:12px;line-height:1.6">Need help? Email <a href="mailto:support@shoprenova.com.ng" style="color:#ff8a68">support@shoprenova.com.ng</a><br>Renova Store · Lagos, Nigeria</td></tr>
    </table>
  </td></tr></table></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "Idempotency-Key": `renova-order-confirmation-${order.orderNumber}`,
    },
    body: JSON.stringify({ from, to: [order.customerEmail], subject: `${messageLabel} — Renova order ${order.orderNumber}`, html }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend rejected order ${order.orderNumber} (${response.status}): ${detail.slice(0, 500)}`);
  }
  return true;
}

async function notifyCustomerAndRecord(order: typeof orders.$inferSelect) {
  const sent = await notifyCustomer(order);
  if (sent) {
    await getDb().update(orders).set({ customerNotifiedAt: new Date().toISOString() }).where(eq(orders.id, order.id));
  }
}

export async function sendOrderNotifications(order: typeof orders.$inferSelect) {
  const results = await Promise.allSettled([notifyOwner(order), notifyCustomerAndRecord(order)]);
  for (const result of results) if (result.status === "rejected") console.error("Order notification failed", result.reason);
}

export async function recordOrderSales(order: typeof orders.$inferSelect) {
  if (order.salesRecordedAt) return order;
  const db = getDb();
  const recordedAt = new Date().toISOString();
  const [claimed] = await db.update(orders).set({ salesRecordedAt: recordedAt, updatedAt: recordedAt })
    .where(and(eq(orders.id, order.id), isNull(orders.salesRecordedAt))).returning();
  if (!claimed) return order;
  const items = JSON.parse(order.itemsJson || "[]") as Array<{ slug?: string; quantity?: number }>;
  for (const item of items) {
    const quantity = Math.max(1, Math.floor(Number(item.quantity ?? 1)));
    if (item.slug) await db.update(products).set({ soldCount: sql`${products.soldCount} + ${quantity}`, updatedAt: recordedAt }).where(eq(products.slug, item.slug));
  }
  return claimed;
}

export async function markOrderPaid(reference: string, paidAmountKobo: number) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, reference)).limit(1);
  if (!order) throw new Error("Order not found.");
  if (paidAmountKobo !== order.totalKobo) throw new Error("Payment amount does not match the order total.");
  // A callback and webhook may arrive independently. If payment was already
  // recorded but the email failed, retry the customer confirmation safely.
  if (order.paymentStatus === "paid") {
    await recordOrderSales(order);
    if (!order.customerNotifiedAt) await notifyCustomerAndRecord(order);
    return order;
  }
  const [updated] = await db.update(orders).set({ paymentStatus: "paid", status: "processing", estimatedDelivery: order.estimatedDelivery ?? "3–5 working days", updatedAt: new Date().toISOString() }).where(eq(orders.id, order.id)).returning();
  const recorded = await recordOrderSales(updated);
  await sendOrderNotifications(recorded);
  return recorded;
}
