import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { orderReminderLogs, orderReminders, orders } from "../../db/schema";

const TERMINAL_STATUSES = new Set(["delivered", "cancelled", "refunded"]);

type Channel = "email" | "whatsapp" | "sms";
type DeliveryResult = {
  channel: Channel;
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string;
  error?: string;
};

function setting(name: string) {
  return process.env[name]?.trim();
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]!);
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function phoneForApi(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `234${digits.slice(1)}`;
  if (digits.length === 10) digits = `234${digits}`;
  if (digits.length < 10 || digits.length > 15) throw new Error("Customer phone number is invalid.");
  return digits;
}

function amountDue(order: typeof orders.$inferSelect) {
  if (order.paymentMethod !== "cash_on_delivery") return "Payment already received";
  return `₦${(order.totalKobo / 100).toLocaleString("en-NG")} due on delivery`;
}

function reminderText(order: typeof orders.$inferSelect, reminder: typeof orderReminders.$inferSelect) {
  const appUrl = (setting("APP_URL") ?? "https://shoprenova.com.ng").replace(/\/$/, "");
  const estimate = reminder.deliveryEstimate || order.estimatedDelivery || "Delivery timing will be updated as movement continues";
  const note = reminder.customerNote ? ` ${reminder.customerNote}` : "";
  return `Hello ${firstName(order.customerName)}, your Renova order ${order.orderNumber} is on the way. Latest verified update: ${reminder.currentCheckpoint}. Expected delivery: ${estimate}. ${amountDue(order)}.${note} Please keep your phone available for the delivery call. Track your order at ${appUrl}/track-order`;
}

async function sendEmail(order: typeof orders.$inferSelect, reminder: typeof orderReminders.$inferSelect): Promise<DeliveryResult> {
  if (!reminder.emailEnabled) return { channel: "email", status: "skipped" };
  const apiKey = setting("RESEND_API_KEY");
  const from = setting("RESEND_FROM_EMAIL") ?? setting("ORDER_FROM_EMAIL");
  if (!apiKey || !from) return { channel: "email", status: "failed", error: "Resend is not configured." };
  if (!order.customerEmail?.includes("@")) return { channel: "email", status: "failed", error: "Customer email is invalid." };
  const appUrl = (setting("APP_URL") ?? "https://shoprenova.com.ng").replace(/\/$/, "");
  const estimate = reminder.deliveryEstimate || order.estimatedDelivery || "We will update you as delivery progresses";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [order.customerEmail],
      subject: `Your Renova order is on the way — ${order.orderNumber}`,
      html: `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#171717"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #e9e2de"><tr><td style="padding:26px 30px;border-bottom:4px solid #ff5a2f"><div style="font-size:24px;font-weight:800;letter-spacing:4px">RENOVA</div><div style="margin-top:6px;color:#777;font-size:12px">DELIVERY UPDATE</div></td></tr><tr><td style="padding:32px 30px"><p style="margin:0 0 12px;font-size:16px">Hello ${escapeHtml(firstName(order.customerName))},</p><h1 style="margin:0 0 14px;font-size:28px;line-height:1.2">Your order is on the way.</h1><p style="margin:0;color:#555;font-size:16px;line-height:1.65">We are keeping watch on your delivery and will continue sending verified updates until it reaches you.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;background:#fff7f2;border-left:4px solid #ff5a2f"><tr><td style="padding:18px"><div style="color:#777;font-size:11px;text-transform:uppercase">Latest verified update</div><div style="margin-top:6px;font-size:17px;font-weight:700">${escapeHtml(reminder.currentCheckpoint)}</div></td></tr><tr><td style="padding:0 18px 18px"><div style="color:#777;font-size:11px;text-transform:uppercase">Expected delivery</div><div style="margin-top:6px;font-size:15px">${escapeHtml(estimate)}</div></td></tr></table>${reminder.customerNote ? `<p style="font-size:15px;line-height:1.6">${escapeHtml(reminder.customerNote)}</p>` : ""}<p style="font-size:15px;line-height:1.6"><b>Order:</b> ${escapeHtml(order.orderNumber)}<br><b>${escapeHtml(amountDue(order))}</b></p><p style="font-size:14px;line-height:1.6;color:#555">Please keep your phone available so the courier can reach you. You do not need to place another order.</p><a href="${escapeHtml(`${appUrl}/track-order`)}" style="display:inline-block;margin-top:8px;background:#ff5a2f;color:#fff;text-decoration:none;font-weight:800;padding:14px 24px">TRACK YOUR ORDER</a></td></tr><tr><td style="padding:20px 30px;background:#171717;color:#fff;font-size:12px;line-height:1.6">Need help? <a href="mailto:support@shoprenova.com.ng" style="color:#ff8a68">support@shoprenova.com.ng</a></td></tr></table></td></tr></table></body></html>`,
    }),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) return { channel: "email", status: "failed", error: payload.message || `Resend returned ${response.status}.` };
  return { channel: "email", status: "sent", providerMessageId: payload.id };
}

async function sendWhatsApp(order: typeof orders.$inferSelect, reminder: typeof orderReminders.$inferSelect): Promise<DeliveryResult> {
  if (!reminder.whatsappEnabled) return { channel: "whatsapp", status: "skipped" };
  const token = setting("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = setting("WHATSAPP_PHONE_NUMBER_ID");
  const template = setting("WHATSAPP_REMINDER_TEMPLATE");
  const apiVersion = setting("WHATSAPP_GRAPH_API_VERSION") ?? "v23.0";
  if (!token || !phoneNumberId || !template) return { channel: "whatsapp", status: "failed", error: "WhatsApp Cloud API or the approved template is not configured." };
  const estimate = reminder.deliveryEstimate || order.estimatedDelivery || "Update pending";
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phoneForApi(order.customerPhone),
      type: "template",
      template: {
        name: template,
        language: { code: setting("WHATSAPP_TEMPLATE_LANGUAGE") ?? "en" },
        components: [{ type: "body", parameters: [
          { type: "text", text: firstName(order.customerName) },
          { type: "text", text: order.orderNumber },
          { type: "text", text: reminder.currentCheckpoint },
          { type: "text", text: estimate },
        ] }],
      },
    }),
  });
  const payload = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { message?: string } };
  if (!response.ok) return { channel: "whatsapp", status: "failed", error: payload.error?.message || `WhatsApp returned ${response.status}.` };
  return { channel: "whatsapp", status: "sent", providerMessageId: payload.messages?.[0]?.id };
}

async function sendSms(order: typeof orders.$inferSelect, reminder: typeof orderReminders.$inferSelect): Promise<DeliveryResult> {
  if (!reminder.smsEnabled) return { channel: "sms", status: "skipped" };
  const apiKey = setting("TERMII_API_KEY");
  const senderId = setting("TERMII_SENDER_ID") ?? "Renova";
  if (!apiKey) return { channel: "sms", status: "failed", error: "Termii is not configured." };
  const response = await fetch(setting("TERMII_API_URL") ?? "https://v3.api.termii.com/api/sms/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      to: phoneForApi(order.customerPhone),
      from: senderId,
      sms: reminderText(order, reminder),
      type: "plain",
      channel: setting("TERMII_CHANNEL") ?? "generic",
    }),
  });
  const payload = await response.json().catch(() => ({})) as { message_id?: string; message?: string };
  if (!response.ok) return { channel: "sms", status: "failed", error: payload.message || `Termii returned ${response.status}.` };
  return { channel: "sms", status: "sent", providerMessageId: payload.message_id };
}

async function attempt(channel: Channel, task: () => Promise<DeliveryResult>): Promise<DeliveryResult> {
  try {
    return await task();
  } catch (error) {
    return { channel, status: "failed", error: error instanceof Error ? error.message : "Message failed." };
  }
}

export function reminderProviderStatus() {
  return {
    email: Boolean(setting("RESEND_API_KEY") && (setting("RESEND_FROM_EMAIL") || setting("ORDER_FROM_EMAIL"))),
    whatsapp: Boolean(setting("WHATSAPP_ACCESS_TOKEN") && setting("WHATSAPP_PHONE_NUMBER_ID") && setting("WHATSAPP_REMINDER_TEMPLATE")),
    sms: Boolean(setting("TERMII_API_KEY")),
  };
}

export async function reminderDashboardData() {
  const db = getDb();
  const [reminders, logs] = await Promise.all([
    db.select().from(orderReminders).orderBy(desc(orderReminders.id)),
    db.select().from(orderReminderLogs).orderBy(desc(orderReminderLogs.id)).limit(100),
  ]);
  return { reminders, logs, providers: reminderProviderStatus() };
}

export async function saveReminder(input: {
  orderId: number;
  consentConfirmed: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  currentCheckpoint: string;
  deliveryEstimate: string;
  customerNote: string;
  start: boolean;
}) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order) throw new Error("Order not found.");
  if (TERMINAL_STATUSES.has(order.status)) throw new Error("Reminders cannot run for a completed or refunded order.");
  if (input.start && !input.consentConfirmed) throw new Error("Confirm the customer's messaging consent before starting reminders.");
  if (!input.emailEnabled && !input.whatsappEnabled && !input.smsEnabled) throw new Error("Select at least one reminder channel.");
  const checkpoint = input.currentCheckpoint.trim();
  if (!checkpoint) throw new Error("Enter the latest verified delivery update.");
  const now = new Date();
  const values = {
    consentConfirmed: input.consentConfirmed,
    emailEnabled: input.emailEnabled,
    whatsappEnabled: input.whatsappEnabled,
    smsEnabled: input.smsEnabled,
    currentCheckpoint: checkpoint,
    deliveryEstimate: input.deliveryEstimate.trim(),
    customerNote: input.customerNote.trim(),
    active: input.start,
    startedAt: input.start ? now.toISOString() : null,
    nextSendAt: input.start ? now.toISOString() : null,
    stoppedAt: input.start ? null : now.toISOString(),
    updatedAt: now.toISOString(),
  };
  const [existing] = await db.select().from(orderReminders).where(eq(orderReminders.orderId, order.id)).limit(1);
  if (existing) {
    const [updated] = await db.update(orderReminders).set(values).where(eq(orderReminders.id, existing.id)).returning();
    return updated;
  }
  const [created] = await db.insert(orderReminders).values({ orderId: order.id, ...values }).returning();
  return created;
}

export async function stopReminder(orderId: number) {
  const now = new Date().toISOString();
  const [updated] = await getDb().update(orderReminders).set({ active: false, stoppedAt: now, nextSendAt: null, updatedAt: now }).where(eq(orderReminders.orderId, orderId)).returning();
  return updated ?? null;
}

export async function stopReminderForTerminalOrder(orderId: number) {
  return stopReminder(orderId);
}

export async function dispatchReminder(reminderId: number, force = false) {
  const db = getDb();
  const [reminder] = await db.select().from(orderReminders).where(eq(orderReminders.id, reminderId)).limit(1);
  if (!reminder || !reminder.active) return { skipped: true, reason: "Reminder is not active." };
  if (!reminder.consentConfirmed) return { skipped: true, reason: "Customer consent is not confirmed." };
  const [order] = await db.select().from(orders).where(eq(orders.id, reminder.orderId)).limit(1);
  if (!order) return { skipped: true, reason: "Order no longer exists." };
  if (TERMINAL_STATUSES.has(order.status)) {
    await stopReminder(order.id);
    return { skipped: true, reason: `Order is ${order.status}.` };
  }
  const now = new Date();
  if (!force && reminder.nextSendAt && new Date(reminder.nextSendAt) > now) return { skipped: true, reason: "Reminder is not due yet." };
  const nextSendAt = new Date(now.getTime() + reminder.intervalHours * 60 * 60 * 1000).toISOString();
  if (!force) {
    const expectedSchedule = reminder.nextSendAt
      ? eq(orderReminders.nextSendAt, reminder.nextSendAt)
      : isNull(orderReminders.nextSendAt);
    const [claimed] = await db.update(orderReminders).set({ nextSendAt, updatedAt: now.toISOString() })
      .where(and(eq(orderReminders.id, reminder.id), eq(orderReminders.active, true), expectedSchedule))
      .returning();
    if (!claimed) return { skipped: true, reason: "Another scheduler already claimed this reminder." };
  }
  const results = await Promise.all([
    attempt("email", () => sendEmail(order, reminder)),
    attempt("whatsapp", () => sendWhatsApp(order, reminder)),
    attempt("sms", () => sendSms(order, reminder)),
  ]);
  const completedAt = new Date().toISOString();
  for (const result of results) {
    if (result.status === "skipped") continue;
    await db.insert(orderReminderLogs).values({
      reminderId: reminder.id,
      orderId: order.id,
      channel: result.channel,
      status: result.status,
      providerMessageId: result.providerMessageId ?? null,
      errorMessage: result.error ?? null,
      checkpoint: reminder.currentCheckpoint,
      createdAt: completedAt,
    });
  }
  const sent = results.filter((result) => result.status === "sent").length;
  await db.update(orderReminders).set({
    lastSentAt: sent ? completedAt : reminder.lastSentAt,
    nextSendAt: sent ? nextSendAt : new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    updatedAt: completedAt,
  }).where(eq(orderReminders.id, reminder.id));
  return { skipped: false, sent, results };
}

export async function runDueReminders() {
  const rows = await getDb().select().from(orderReminders).where(eq(orderReminders.active, true));
  const now = Date.now();
  const due = rows.filter((row) => !row.nextSendAt || new Date(row.nextSendAt).getTime() <= now).slice(0, 50);
  const results = [];
  for (const reminder of due) results.push({ reminderId: reminder.id, result: await dispatchReminder(reminder.id) });
  return { checked: rows.length, due: due.length, results };
}
