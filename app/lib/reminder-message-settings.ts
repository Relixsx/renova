import { eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { orderReminders, orders, reminderMessageSettings } from "../../db/schema";
import { confirmedOrder } from "./whatsapp-message";
import { validateJumiaDeliveryWindow } from "./jumia-delivery-countdown";
import { DEFAULT_REMINDER_MESSAGES, ReminderMessageError, validateMessageDefaults, validateMessageOverrides, type MessageDefaults } from "./reminder-message-content";

export async function reminderMessageDefaults(): Promise<MessageDefaults> {
  const [row] = await getDb().select().from(reminderMessageSettings).where(eq(reminderMessageSettings.id, "default")).limit(1);
  if (!row) return DEFAULT_REMINDER_MESSAGES;
  return validateMessageDefaults({ routine: JSON.parse(row.dailyJson), arrival: JSON.parse(row.arrivalJson) });
}

export async function saveReminderMessageDefaults(input: unknown) {
  const defaults = validateMessageDefaults(input);
  const values = { dailyJson: JSON.stringify(defaults.routine), arrivalJson: JSON.stringify(defaults.arrival), updatedAt: new Date().toISOString() };
  await getDb().insert(reminderMessageSettings).values({ id: "default", ...values }).onConflictDoUpdate({ target: reminderMessageSettings.id, set: values });
  return defaults;
}

export async function saveOrderMessageEdits(orderId: number, input: unknown, checkpoint?: unknown, arrivalCheckpoint?: unknown, jumiaDeliveryWindow?: unknown) {
  const patch = validateMessageOverrides(input);
  const dates = jumiaDeliveryWindow === undefined ? undefined : validateJumiaDeliveryWindow(jumiaDeliveryWindow);
  for (const value of [checkpoint, arrivalCheckpoint]) if (value !== undefined && (typeof value !== "string" || value.trim().length > 500)) throw new ReminderMessageError("Courier updates must be text, with at most 500 characters.");
  const db = getDb();
  const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new ReminderMessageError("Order not found.", 404);
  const now = new Date().toISOString();
  const values = {
    messageOverridesJson: JSON.stringify(patch),
    ...(typeof checkpoint === "string" ? { currentCheckpoint: checkpoint.trim() } : {}),
    ...(typeof arrivalCheckpoint === "string" ? { arrivalCheckpoint: arrivalCheckpoint.trim() } : {}),
    ...(dates ? { jumiaDeliveryFrom: dates.from, jumiaDeliveryTo: dates.to } : {}),
    updatedAt: now,
  };
  const patchJson = JSON.stringify(patch);
  const mergedKind = (kind: "routine" | "arrival") => sql`CASE WHEN ${patchJson}::jsonb ? ${kind} THEN
    jsonb_build_object(${kind}::text, CASE WHEN ${patchJson}::jsonb -> ${kind} = 'null'::jsonb THEN 'null'::jsonb
      ELSE COALESCE(NULLIF(${orderReminders.messageOverridesJson}::jsonb -> ${kind}, 'null'::jsonb), '{}'::jsonb) || (${patchJson}::jsonb -> ${kind}) END)
    ELSE '{}'::jsonb END`;
  // Editing copy does not opt a customer in, enable a channel, restart a paused
  // order, change its phase or advance the next sending time.
  const [reminder] = await db.insert(orderReminders).values({ orderId, emailEnabled: false, ...values }).onConflictDoUpdate({
    target: orderReminders.orderId,
    set: { ...values, messageOverridesJson: sql`(${orderReminders.messageOverridesJson}::jsonb || ${mergedKind("routine")} || ${mergedKind("arrival")})::text` },
  }).returning();
  return reminder;
}

export async function confirmOrderArrival(orderId: number, checkpoint: unknown, confirmed: unknown) {
  if (confirmed !== true) throw new ReminderMessageError("Confirm that the courier has verified this parcel has arrived before starting arrival reminders.");
  if (typeof checkpoint !== "string" || !checkpoint.trim() || checkpoint.trim().length > 500) throw new ReminderMessageError("Enter the verified arrival or collection information, using at most 500 characters.");
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new ReminderMessageError("Order not found.", 404);
  if (!confirmedOrder(order)) throw new ReminderMessageError("Arrival reminders are available for confirmed orders awaiting delivery or collection.", 409);
  const now = new Date().toISOString();
  // Repeated/concurrent arrival clicks transition once. The due schedule is
  // durable, so the scheduler can recover a crash before the first dispatch.
  const result = await db.execute(sql`
    WITH target AS MATERIALIZED (
      SELECT id FROM orders WHERE id = ${orderId}
        AND status IN ('confirmed', 'processing', 'packaged', 'dispatched')
        AND (payment_method = 'cash_on_delivery' OR payment_status = 'paid') FOR UPDATE
    ), changed AS (
      UPDATE order_reminders SET reminder_phase = 'arrival', arrival_checkpoint = ${checkpoint.trim()},
        arrival_confirmed_at = ${now}, arrival_announced_at = NULL,
        next_send_at = CASE WHEN active THEN ${now} ELSE NULL END, updated_at = ${now}
      WHERE order_id IN (SELECT id FROM target) AND reminder_phase <> 'arrival'
      RETURNING id, order_id
    ), cancelled AS (
      UPDATE whatsapp_messages SET status = 'cancelled', error_message = 'Replaced by verified arrival reminders.', updated_at = ${now}
      WHERE order_id IN (SELECT order_id FROM changed) AND status = 'pending' RETURNING id
    ) SELECT id FROM changed`);
  const [reminder] = await db.select().from(orderReminders).where(eq(orderReminders.orderId, orderId)).limit(1);
  if (!reminder) throw new ReminderMessageError("Save the order's message settings or start its WhatsApp notifications first.");
  return { reminder, changed: result.rows.length > 0 };
}
