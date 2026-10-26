import { reminderMessageDefaults } from "./reminder-message-settings";
import type { MessageDefaults } from "./reminder-message-content";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { orderReminderLogs, orderReminders, orders, whatsappMessages } from "../../db/schema";
import { confirmedOrder, DAY_MS, orderStageText, phoneForWhatsApp, reminderMessageFields, type MessageReminder, TERMINAL_ORDER_STATUSES } from "./whatsapp-message";
import { whatsappConfigured, whatsappSettings } from "./whatsapp-delivery";
import { cancelQueuedWhatsApp, dispatchWhatsApp, enqueueWhatsApp, runWhatsAppQueue } from "./whatsapp-notifications";

const TERMINAL_STATUSES = TERMINAL_ORDER_STATUSES;

type Channel = "email" | "whatsapp" | "sms";
type DeliveryResult = {
  channel: Channel;
  status: "sent" | "accepted" | "pending" | "uncertain" | "cancelled" | "failed" | "skipped";
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


function amountDue(order: typeof orders.$inferSelect) {
  if (order.paymentMethod !== "cash_on_delivery") return "Payment already received";
  return `₦${(order.totalKobo / 100).toLocaleString("en-NG")} due on delivery`;
}

export function reminderText(order: typeof orders.$inferSelect, reminder: MessageReminder, kind: "routine" | "arrival" = "routine", defaults?: MessageDefaults, now?: Date) {
  const fields = reminderMessageFields(order, reminder, kind, defaults, now);
  return `Hello ${firstName(order.customerName)}, ${fields.message} Order: ${order.orderNumber}. Expected delivery: ${fields.estimate}. ${amountDue(order)}. ${fields.note} Track your order at https://shoprenova.com.ng/track-order`;
}

async function sendEmail(order: typeof orders.$inferSelect, reminder: typeof orderReminders.$inferSelect, kind: "routine" | "arrival" = "routine", defaults?: MessageDefaults): Promise<DeliveryResult> {
  if (!reminder.emailEnabled) return { channel: "email", status: "skipped" };
  const apiKey = setting("RESEND_API_KEY");
  const from = setting("RESEND_FROM_EMAIL") ?? setting("ORDER_FROM_EMAIL");
  if (!apiKey || !from) return { channel: "email", status: "failed", error: "Resend is not configured." };
  if (!order.customerEmail?.includes("@")) return { channel: "email", status: "failed", error: "Customer email is invalid." };
  const appUrl = (setting("APP_URL") ?? "https://shoprenova.com.ng").replace(/\/$/, "");
  const fields = reminderMessageFields(order, reminder, kind, defaults);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [order.customerEmail],
      subject: fields.subject,
      html: `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#171717"><table role="presentation" width="100%" style="padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" style="max-width:640px;background:#fff;border:1px solid #e9e2de"><tr><td style="padding:26px 30px;border-bottom:4px solid #ff5a2f;font-size:24px;font-weight:800;letter-spacing:4px">RENOVA</td></tr><tr><td style="padding:32px 30px"><p>Hello ${escapeHtml(firstName(order.customerName))},</p><h1 style="font-size:26px">${escapeHtml(fields.heading)}</h1><p style="white-space:pre-line;line-height:1.7">${escapeHtml(fields.message)}</p><p><b>Expected delivery:</b> ${escapeHtml(fields.estimate)}</p><p style="white-space:pre-line;line-height:1.7">${escapeHtml(fields.note)}</p><p><b>Order:</b> ${escapeHtml(order.orderNumber)}<br><b>${escapeHtml(amountDue(order))}</b></p><p>Please keep your phone available so the courier can reach you. You do not need to place another order.</p><a href="${escapeHtml(`${appUrl}/track-order`)}" style="display:inline-block;background:#ff5a2f;color:#fff;padding:14px 24px;text-decoration:none">TRACK YOUR ORDER</a></td></tr><tr><td style="padding:20px 30px;background:#171717;color:#fff;font-size:12px">Need help? support@shoprenova.com.ng</td></tr></table></td></tr></table></body></html>`,
    }),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) return { channel: "email", status: "failed", error: payload.message || `Resend returned ${response.status}.` };
  return { channel: "email", status: "sent", providerMessageId: payload.id };
}

async function sendSms(order: typeof orders.$inferSelect, reminder: typeof orderReminders.$inferSelect, kind: "routine" | "arrival" = "routine", defaults?: MessageDefaults): Promise<DeliveryResult> {
  if (!reminder.smsEnabled) return { channel: "sms", status: "skipped" };
  const apiKey = setting("TERMII_API_KEY");
  const senderId = setting("TERMII_SENDER_ID") ?? "Renova";
  if (!apiKey) return { channel: "sms", status: "failed", error: "Termii is not configured." };
  const response = await fetch(setting("TERMII_API_URL") ?? "https://v3.api.termii.com/api/sms/send", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      to: phoneForWhatsApp(order.customerPhone),
      from: senderId,
      sms: reminderText(order, reminder, kind, defaults),
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
    whatsapp: whatsappConfigured(whatsappSettings()),
    sms: Boolean(setting("TERMII_API_KEY")),
  };
}

export async function reminderDashboardData() {
  const db = getDb();
  const [reminders, logs, whatsapp, contacts, messageDefaults] = await Promise.all([
    db.select().from(orderReminders).orderBy(desc(orderReminders.id)),
    db.select().from(orderReminderLogs).orderBy(desc(orderReminderLogs.id)).limit(100),
    db.select().from(whatsappMessages).orderBy(desc(whatsappMessages.id)).limit(100),
    db.select({ orderId: orders.id, phone: orders.whatsappPhone, consentAt: orders.whatsappConsentAt, optedOutAt: orders.whatsappOptedOutAt }).from(orders),
    reminderMessageDefaults(),
  ]);
  return { reminders, logs, messageDefaults, whatsappMessages: whatsapp, whatsappContacts: contacts, providers: reminderProviderStatus() };
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
  if (!confirmedOrder(order)) throw new Error("Only confirmed payment-on-delivery orders or verified paid orders can receive reminders.");
  if (input.whatsappEnabled && order.whatsappOptedOutAt) throw new Error("This customer opted out of WhatsApp updates. Do not re-enable messaging for this order.");
  if (input.start && !input.consentConfirmed) throw new Error("Confirm the customer's messaging consent before starting reminders.");
  if (input.whatsappEnabled && !input.consentConfirmed) throw new Error("Confirm the customer's WhatsApp consent before selecting that channel.");
  if (!input.emailEnabled && !input.whatsappEnabled && !input.smsEnabled) throw new Error("Select at least one reminder channel.");
  const checkpoint = input.currentCheckpoint.trim();
  // An empty checkpoint uses the current order stage instead of inventing a courier location.
  const now = new Date();
  const [existing] = await db.select().from(orderReminders).where(eq(orderReminders.orderId, order.id)).limit(1);
  if (input.whatsappEnabled) {
    const [consented] = await db.update(orders).set({ whatsappPhone: phoneForWhatsApp(order.whatsappPhone || order.customerPhone), whatsappConsentAt: order.whatsappConsentAt || now.toISOString(),
      whatsappConsentSource: order.whatsappConsentSource || "owner-recorded" }).where(and(eq(orders.id, order.id), sql`${orders.whatsappOptedOutAt} IS NULL`)).returning({ id: orders.id });
    if (!consented) throw new Error("This customer opted out of WhatsApp updates.");
  } else await cancelQueuedWhatsApp(order.id);
  const values = {
    consentConfirmed: input.consentConfirmed,
    emailEnabled: input.emailEnabled,
    whatsappEnabled: input.whatsappEnabled,
    smsEnabled: input.smsEnabled,
    currentCheckpoint: checkpoint,
    deliveryEstimate: input.deliveryEstimate.trim(),
    customerNote: input.customerNote.trim(),
    active: input.start,
    startedAt: input.start ? existing?.startedAt || now.toISOString() : null,
    nextSendAt: input.start ? (existing?.active ? existing.nextSendAt : now.toISOString()) : null,
    stoppedAt: input.start ? null : now.toISOString(),
    updatedAt: now.toISOString(),
  };
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
  await cancelQueuedWhatsApp(orderId);
  return updated ?? null;
}

export async function stopReminderForTerminalOrder(orderId: number) {
  return stopReminder(orderId);
}

export async function dispatchReminder(reminderId: number, force = false, requestedKind?: "routine" | "arrival") {
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
  if (!confirmedOrder(order)) return { skipped: true, reason: "Order is awaiting payment or confirmation." };
  if ((requestedKind === "arrival" || reminder.reminderPhase === "arrival") && !reminder.arrivalConfirmedAt) return { skipped: true, reason: "Arrival has not been verified by the owner." };
  const kind = reminder.reminderPhase === "arrival" ? (reminder.arrivalAnnouncedAt ? "arrival_reminder" : "arrival") : "routine";
  const channelKind = kind === "routine" ? "routine" : "arrival";
  const defaults = await reminderMessageDefaults();
  const now = new Date();
  if (!force && reminder.nextSendAt && new Date(reminder.nextSendAt) > now) return { skipped: true, reason: "Reminder is not due yet." };
  const nextSendAt = new Date(now.getTime() + DAY_MS).toISOString();
  const dedupeKey = kind === "arrival" ? `arrival:${order.id}:first` : `${kind}:${reminder.id}:${reminder.nextSendAt || reminder.startedAt || "initial"}`;
  // Claim the schedule and persist its WhatsApp job in ONE database statement.
  // A process crash cannot advance the daily deadline without queuing the job.
  const claim = await db.execute(sql`
    WITH claimed AS (
      UPDATE order_reminders SET next_send_at = ${nextSendAt}, updated_at = ${now.toISOString()},
        arrival_announced_at = CASE WHEN ${kind} = 'arrival' THEN ${now.toISOString()} ELSE arrival_announced_at END
      WHERE id = ${reminder.id} AND active = true AND consent_confirmed = true
        AND reminder_phase = ${reminder.reminderPhase}
        AND next_send_at IS NOT DISTINCT FROM ${reminder.nextSendAt}::text
      RETURNING id, order_id, whatsapp_enabled
    ), queued AS (
      INSERT INTO whatsapp_messages (order_id, reminder_id, kind, dedupe_key, next_attempt_at, created_at, updated_at)
      SELECT order_id, id, ${kind}, ${dedupeKey}, ${now.toISOString()}, ${now.toISOString()}, ${now.toISOString()}
      FROM claimed WHERE whatsapp_enabled = true
      ON CONFLICT DO NOTHING RETURNING id
    ) SELECT id FROM claimed`);
  if (!claim.rows.length) return { skipped: true, reason: "Another sender already claimed this reminder." };
  const whatsapp = async (): Promise<DeliveryResult> => {
    if (!reminder.whatsappEnabled) return { channel: "whatsapp", status: "skipped" };
    const message = await enqueueWhatsApp(order.id, reminder.id, kind, dedupeKey);
    if (!message) return { channel: "whatsapp", status: "skipped" };
    const result = await dispatchWhatsApp(message.id);
    return { channel: "whatsapp", ...result, status: result.status as DeliveryResult["status"] };
  };
  const results = await Promise.all([
    attempt("email", () => sendEmail(order, reminder, channelKind, defaults)),
    attempt("whatsapp", whatsapp),
    attempt("sms", () => sendSms(order, reminder, channelKind, defaults)),
  ]);
  const completedAt = new Date().toISOString();
  for (const result of results) {
    if (result.status === "skipped") continue;
    await db.insert(orderReminderLogs).values({
      reminderId: reminder.id, orderId: order.id, channel: result.channel, status: result.status,
      providerMessageId: result.providerMessageId ?? null, errorMessage: result.error ?? null,
      checkpoint: reminder.currentCheckpoint || orderStageText(order.status), createdAt: completedAt,
    });
  }
  const sent = results.filter((result) => ["sent", "accepted", "delivered", "read"].includes(result.status)).length;
  if (sent) await db.update(orderReminders).set({ lastSentAt: completedAt, updatedAt: completedAt })
    .where(and(eq(orderReminders.id, reminder.id), eq(orderReminders.active, true)));
  else if (!reminder.whatsappEnabled) await db.update(orderReminders).set({ nextSendAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), updatedAt: completedAt })
    .where(and(eq(orderReminders.id, reminder.id), eq(orderReminders.active, true), eq(orderReminders.nextSendAt, nextSendAt)));
  return { skipped: false, sent, results };
}

export async function runDueReminders() {
  const deadline = Date.now() + 40_000;
  const rows = await getDb().select().from(orderReminders).where(eq(orderReminders.active, true));
  const now = Date.now();
  const due = rows.filter((row) => !row.nextSendAt || new Date(row.nextSendAt).getTime() <= now).slice(0, 50);
  const results = [];
  for (const reminder of due) {
    if (Date.now() > deadline - 22_000) break;
    try { results.push({ reminderId: reminder.id, result: await dispatchReminder(reminder.id) }); }
    catch { results.push({ reminderId: reminder.id, error: "The reminder could not be processed. Check the server logs." }); }
  }
  const whatsapp = await runWhatsAppQueue(deadline);
  return { checked: rows.length, due: due.length, results, whatsapp };
}
