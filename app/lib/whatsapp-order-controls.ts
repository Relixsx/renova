import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { orderReminders, orders } from "../../db/schema";
import { confirmedOrder, DAY_MS, phoneForWhatsApp } from "./whatsapp-message";
import { dispatchWhatsApp } from "./whatsapp-notifications";

export class WhatsAppControlError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function whatsappOrderContact(orderId: number) {
  const [contact] = await getDb().select({ orderId: orders.id, phone: orders.whatsappPhone, consentAt: orders.whatsappConsentAt, optedOutAt: orders.whatsappOptedOutAt })
    .from(orders).where(eq(orders.id, orderId)).limit(1);
  return contact;
}

export async function startOrderWhatsApp(input: { orderId: number; phone?: string; consentConfirmed: boolean }) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order) throw new WhatsAppControlError("Order not found.", 404);
  if (!confirmedOrder(order)) throw new WhatsAppControlError("WhatsApp updates are available for confirmed payment-on-delivery orders or verified paid orders awaiting delivery.", 409);
  if (order.whatsappOptedOutAt) throw new WhatsAppControlError("This customer requested STOP. WhatsApp cannot be restarted for this order.", 409);
  let phone: string;
  try { phone = phoneForWhatsApp(input.phone || order.whatsappPhone || ""); }
  catch { throw new WhatsAppControlError("Enter a valid customer WhatsApp number."); }
  if (!order.whatsappConsentAt && !input.consentConfirmed) throw new WhatsAppControlError("Record the customer's agreement to WhatsApp order updates before starting.");
  if (order.whatsappConsentAt && order.whatsappPhone && phone !== phoneForWhatsApp(order.whatsappPhone)) {
    throw new WhatsAppControlError("Use this order's recorded WhatsApp number. A different recipient requires fresh customer agreement.");
  }
  const now = new Date().toISOString();
  const next = new Date(Date.parse(now) + DAY_MS).toISOString();
  const key = `activation:${order.id}:${crypto.randomUUID()}`;
  // Serialize start/stop on the order. A repeated click only queues a message
  // when WhatsApp actually transitions from off to on (or legacy setup is missing).
  // Consent, channel activation and the first job are committed together.
  const result = await db.execute(sql`
    WITH target AS MATERIALIZED (
      SELECT id, (whatsapp_consent_at IS NULL OR COALESCE(whatsapp_phone, '') = '') AS needs_setup
      FROM orders WHERE id = ${order.id} AND whatsapp_opted_out_at IS NULL
        AND status IN ('confirmed', 'processing', 'packaged', 'dispatched')
        AND (payment_method = 'cash_on_delivery' OR payment_status = 'paid')
        AND (whatsapp_consent_at IS NOT NULL OR ${input.consentConfirmed})
        AND (whatsapp_consent_at IS NULL OR whatsapp_phone IS NULL OR whatsapp_phone = '' OR whatsapp_phone = ${phone})
      FOR UPDATE
    ), consented AS (
      UPDATE orders SET whatsapp_phone = ${phone},
        whatsapp_consent_at = COALESCE(whatsapp_consent_at, ${now}),
        whatsapp_consent_source = COALESCE(whatsapp_consent_source, 'owner-recorded'), updated_at = ${now}
      WHERE id IN (SELECT id FROM target) RETURNING id
    ), enabled AS (
      INSERT INTO order_reminders (order_id, active, consent_confirmed, email_enabled, whatsapp_enabled, sms_enabled,
        current_checkpoint, delivery_estimate, customer_note, interval_hours, started_at, next_send_at, created_at, updated_at)
      SELECT id, true, true, false, true, false, '', '', '', 24, ${now}, ${next}, ${now}, ${now} FROM consented
      ON CONFLICT (order_id) DO UPDATE SET active = true, consent_confirmed = true, whatsapp_enabled = true,
        started_at = COALESCE(order_reminders.started_at, ${now}), stopped_at = NULL,
        next_send_at = CASE WHEN order_reminders.active AND (order_reminders.email_enabled OR order_reminders.sms_enabled)
          THEN COALESCE(order_reminders.next_send_at, ${next}) ELSE ${next} END, updated_at = ${now}
      WHERE NOT order_reminders.active OR NOT order_reminders.whatsapp_enabled OR (SELECT needs_setup FROM target)
      RETURNING id, order_id
    ), cancelled AS (
      UPDATE whatsapp_messages SET status = 'cancelled', error_message = 'Superseded by manually started WhatsApp updates.', updated_at = ${now}
      WHERE order_id IN (SELECT order_id FROM enabled) AND status = 'pending' RETURNING id
    ), queued AS (
      INSERT INTO whatsapp_messages (order_id, reminder_id, kind, dedupe_key, next_attempt_at, created_at, updated_at)
      SELECT order_id, id, 'activation', ${key}, ${now}, ${now}, ${now} FROM enabled
      RETURNING id
    ) SELECT id AS message_id FROM queued`);
  const [reminder] = await db.select().from(orderReminders).where(eq(orderReminders.orderId, order.id)).limit(1);
  const contact = await whatsappOrderContact(order.id);
  const row = result.rows[0] as { message_id?: number } | undefined;
  if (!row) {
    const [latest] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    if (!latest || !confirmedOrder(latest)) throw new WhatsAppControlError("This order is no longer awaiting delivery or payment confirmation changed.", 409);
    if (contact?.optedOutAt) throw new WhatsAppControlError("This customer requested STOP. WhatsApp cannot be restarted for this order.", 409);
    if (!reminder?.active || !reminder.whatsappEnabled) throw new WhatsAppControlError("The order changed while starting WhatsApp. Refresh and check its status.", 409);
    return { changed: false, reminder, contact, delivery: { status: "already_active" } };
  }
  const delivery = await dispatchWhatsApp(Number(row.message_id));
  return { changed: true, reminder, contact, delivery };
}

export async function stopOrderWhatsApp(orderId: number) {
  const db = getDb();
  const now = new Date().toISOString();
  // This is a reversible owner pause for one order, not a customer opt-out.
  // Other selected channels and their schedules remain enabled.
  await db.execute(sql`
    WITH target AS MATERIALIZED (SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE), disabled AS (
      UPDATE order_reminders SET whatsapp_enabled = false,
        active = CASE WHEN email_enabled OR sms_enabled THEN active ELSE false END,
        next_send_at = CASE WHEN email_enabled OR sms_enabled THEN next_send_at ELSE NULL END,
        stopped_at = CASE WHEN email_enabled OR sms_enabled THEN stopped_at ELSE ${now} END, updated_at = ${now}
      WHERE order_id IN (SELECT id FROM target) RETURNING id
    ), cancelled AS (
      UPDATE whatsapp_messages SET status = 'cancelled', error_message = 'WhatsApp paused by the owner for this order.', updated_at = ${now}
      WHERE order_id IN (SELECT id FROM target) AND status = 'pending' RETURNING id
    ) SELECT id FROM disabled`);
  const [reminder] = await db.select().from(orderReminders).where(and(eq(orderReminders.orderId, orderId))).limit(1);
  const contact = await whatsappOrderContact(orderId);
  if (!contact) throw new WhatsAppControlError("Order not found.", 404);
  return { reminder: reminder ?? null, contact };
}
