import { and, desc, eq, inArray, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { orderReminders, orders, whatsappMessages, whatsappReceipts } from "../../db/schema";
import { deliverQueuedWhatsApp, whatsappSettings, type DeliveryPatch, type WhatsAppDeliveryStore } from "./whatsapp-delivery";
import { ACCEPTED_WHATSAPP_STATUSES, confirmedOrder, DAY_MS, phoneForWhatsApp, whatsappTemplateParameters, type WhatsAppKind } from "./whatsapp-message";

import { CHECKOUT_WHATSAPP_SOURCES } from "./checkout-whatsapp";
export { checkoutWhatsAppConsent } from "./checkout-whatsapp";

const store: WhatsAppDeliveryStore = {
  async load(id) {
    const db = getDb();
    const [row] = await db.select({ message: whatsappMessages, order: orders, reminder: orderReminders })
      .from(whatsappMessages).innerJoin(orders, eq(orders.id, whatsappMessages.orderId))
      .innerJoin(orderReminders, eq(orderReminders.id, whatsappMessages.reminderId)).where(eq(whatsappMessages.id, id)).limit(1);
    if (!row) return null;
    const { message, order, reminder } = row;
    let to = "";
    try { to = phoneForWhatsApp(order.whatsappPhone || ""); } catch { /* Invalid numbers are never sent to Meta. */ }
    const eligible = Boolean(to && order.whatsappConsentAt && !order.whatsappOptedOutAt && confirmedOrder(order)
      && reminder.active && reminder.consentConfirmed && reminder.whatsappEnabled);
    let deferUntil: string | undefined;
    if (eligible && message.kind === "routine") {
      const [confirmation] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.dedupeKey, `confirmation:${order.id}`)).limit(1);
      if (confirmation && !ACCEPTED_WHATSAPP_STATUSES.includes(confirmation.status)) {
        deferUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      } else {
        const [last] = await db.select().from(whatsappMessages).where(and(eq(whatsappMessages.orderId, order.id), inArray(whatsappMessages.status, ACCEPTED_WHATSAPP_STATUSES), isNotNull(whatsappMessages.acceptedAt)))
          .orderBy(desc(whatsappMessages.acceptedAt)).limit(1);
        if (last?.acceptedAt && Date.parse(last.acceptedAt) + DAY_MS > Date.now()) deferUntil = new Date(Date.parse(last.acceptedAt) + DAY_MS).toISOString();
      }
    }
    return { id, status: message.status, attempts: message.attempts, nextAttemptAt: message.nextAttemptAt, eligible,
      reason: "The order is unpaid, completed, stopped, missing WhatsApp consent or opted out.", deferUntil, to,
      parameters: whatsappTemplateParameters(order, reminder, message.kind as WhatsAppKind) };
  },
  async claim(id, now) {
    try {
      const [claimed] = await getDb().update(whatsappMessages).set({ status: "sending", claimedAt: now, updatedAt: now, attempts: sql`${whatsappMessages.attempts} + 1` })
        .where(and(eq(whatsappMessages.id, id), eq(whatsappMessages.status, "pending"), lte(whatsappMessages.nextAttemptAt, now),
          sql`NOT EXISTS (SELECT 1 FROM whatsapp_messages other WHERE other.order_id = ${whatsappMessages.orderId} AND other.status = 'sending')`)).returning({ id: whatsappMessages.id });
      return Boolean(claimed);
    } catch (error) {
      // The partial unique index also serializes two different messages for the
      // same order, even when separate server instances race on the SELECT.
      const cause = error as { code?: string; cause?: { code?: string } };
      if (cause.code === "23505" || cause.cause?.code === "23505") return false;
      throw error;
    }
  },
  async finish(id, patch: DeliveryPatch, now) {
    const db = getDb();
    const [saved] = await db.update(whatsappMessages).set({ ...patch, updatedAt: now }).where(and(eq(whatsappMessages.id, id), eq(whatsappMessages.status, "sending"))).returning();
    if (saved?.status === "accepted") {
      await db.update(orderReminders).set({ lastSentAt: now, nextSendAt: new Date(Date.parse(now) + DAY_MS).toISOString(), updatedAt: now })
        .where(and(eq(orderReminders.id, saved.reminderId), eq(orderReminders.active, true), eq(orderReminders.whatsappEnabled, true)));
      // Coalesce an outage into the latest update instead of replaying old daily
      // reminders in a burst when credentials or the network recover.
      await db.update(whatsappMessages).set({ status: "cancelled", errorMessage: "Superseded by a newer accepted update.", updatedAt: now })
        .where(and(eq(whatsappMessages.orderId, saved.orderId), ne(whatsappMessages.id, id), eq(whatsappMessages.kind, "routine"), eq(whatsappMessages.status, "pending")));
      if (saved.providerMessageId) await reconcileWhatsAppReceipt(saved.providerMessageId);
    }
  },
};

export function dispatchWhatsApp(id: number) {
  return deliverQueuedWhatsApp(store, id, whatsappSettings());
}

export async function enqueueWhatsApp(orderId: number, reminderId: number, kind: WhatsAppKind, dedupeKey: string) {
  const db = getDb();
  const now = new Date().toISOString();
  const [created] = await db.insert(whatsappMessages).values({ orderId, reminderId, kind, dedupeKey, nextAttemptAt: now, createdAt: now, updatedAt: now }).onConflictDoNothing().returning();
  if (created) return created;
  const [same] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.dedupeKey, dedupeKey)).limit(1);
  if (same) return same;
  const [pending] = await db.select().from(whatsappMessages).where(and(eq(whatsappMessages.orderId, orderId), eq(whatsappMessages.kind, "routine"), inArray(whatsappMessages.status, ["pending", "sending"]))).limit(1);
  return pending ?? null;
}

export async function confirmOrderWhatsApp(orderId: number) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.whatsappConsentAt || !CHECKOUT_WHATSAPP_SOURCES.includes(order.whatsappConsentSource || "") || order.whatsappOptedOutAt || !confirmedOrder(order)) return { status: "skipped" };
  const [manual] = await db.select({ id: whatsappMessages.id }).from(whatsappMessages).where(and(eq(whatsappMessages.orderId, orderId), eq(whatsappMessages.kind, "activation"))).limit(1);
  if (manual) return { status: "skipped" };
  const now = new Date().toISOString();
  // Existing stopped reminders and channel choices are never re-enabled by a
  // repeated Paystack callback. Legacy orders have no WhatsApp consent timestamp.
  await db.insert(orderReminders).values({ orderId, active: true, consentConfirmed: true, emailEnabled: false, whatsappEnabled: true, smsEnabled: false,
    currentCheckpoint: "", deliveryEstimate: "", customerNote: "", intervalHours: 24, startedAt: now,
    nextSendAt: new Date(Date.parse(now) + DAY_MS).toISOString(), createdAt: now, updatedAt: now }).onConflictDoNothing();
  const [reminder] = await db.select().from(orderReminders).where(eq(orderReminders.orderId, orderId)).limit(1);
  const message = await enqueueWhatsApp(orderId, reminder.id, "confirmation", `confirmation:${orderId}`);
  return message ? dispatchWhatsApp(message.id) : { status: "skipped" };
}

export async function cancelQueuedWhatsApp(orderId: number) {
  await getDb().update(whatsappMessages).set({ status: "cancelled", errorMessage: "Order reminders stopped.", updatedAt: new Date().toISOString() })
    .where(and(eq(whatsappMessages.orderId, orderId), eq(whatsappMessages.status, "pending")));
}

export async function optOutWhatsApp(phone: string) {
  const db = getDb();
  const normalized = phoneForWhatsApp(phone);
  const now = new Date().toISOString();
  const optedOut = await db.update(orders).set({ whatsappOptedOutAt: now, updatedAt: now }).where(eq(orders.whatsappPhone, normalized)).returning({ id: orders.id });
  if (!optedOut.length) return;
  const ids = optedOut.map((order) => order.id);
  await db.update(orderReminders).set({ whatsappEnabled: false,
    active: sql`CASE WHEN ${orderReminders.emailEnabled} OR ${orderReminders.smsEnabled} THEN ${orderReminders.active} ELSE false END`,
    nextSendAt: sql`CASE WHEN ${orderReminders.emailEnabled} OR ${orderReminders.smsEnabled} THEN ${orderReminders.nextSendAt} ELSE NULL END`, updatedAt: now })
    .where(inArray(orderReminders.orderId, ids));
  await db.update(whatsappMessages).set({ status: "cancelled", errorMessage: "Customer opted out of WhatsApp updates.", updatedAt: now })
    .where(and(inArray(whatsappMessages.orderId, ids), eq(whatsappMessages.status, "pending")));
}

export async function retryWhatsApp(id: number, checkedUncertain: boolean) {
  const db = getDb();
  const [message] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.id, id)).limit(1);
  if (!message || !["failed", "uncertain"].includes(message.status)) throw new Error("Only failed or uncertain WhatsApp messages can be retried.");
  if (message.status === "uncertain" && !checkedUncertain) throw new Error("Check WhatsApp Manager first and confirm that this message was not delivered before retrying.");
  if (message.kind === "routine") {
    const [newer] = await db.select({ id: whatsappMessages.id }).from(whatsappMessages).where(and(eq(whatsappMessages.orderId, message.orderId), ne(whatsappMessages.id, message.id), eq(whatsappMessages.kind, "routine"), inArray(whatsappMessages.status, ["pending", "sending"])));
    if (newer) throw new Error("A newer daily update is already queued. Check that message instead.");
  }
  const now = new Date().toISOString();
  const [reset] = await db.update(whatsappMessages).set({ status: "pending", attempts: 0, nextAttemptAt: now, errorMessage: null, providerMessageId: null, acceptedAt: null, updatedAt: now })
    .where(and(eq(whatsappMessages.id, id), eq(whatsappMessages.status, message.status))).returning();
  return reset ? dispatchWhatsApp(id) : { status: "skipped" };
}

const allowedPrevious: Record<string, string[]> = {
    sent: ["accepted"], delivered: ["accepted", "sent", "failed"], read: ["accepted", "sent", "delivered", "failed"], failed: ["accepted", "sent"],
};

async function reconcileWhatsAppReceipt(id: string) {
  const [receipt] = await getDb().select().from(whatsappReceipts).where(eq(whatsappReceipts.providerMessageId, id)).limit(1);
  if (!receipt || !allowedPrevious[receipt.status]) return;
  const { status, errorCode } = receipt;
  await getDb().update(whatsappMessages).set({ status, updatedAt: new Date().toISOString(),
    errorMessage: status === "failed" ? `Meta reported delivery failure (code ${errorCode ?? "unknown"}).` : null })
    .where(and(eq(whatsappMessages.providerMessageId, id), inArray(whatsappMessages.status, allowedPrevious[status])));
}

export async function recordWhatsAppStatus(id: string, status: string, errorCode?: number) {
  if (!allowedPrevious[status] || !id.startsWith("wamid.") || id.length > 300) return;
  await getDb().insert(whatsappReceipts).values({ providerMessageId: id, status, errorCode: errorCode ?? null, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: whatsappReceipts.providerMessageId,
      set: { status, errorCode: errorCode ?? null, updatedAt: new Date().toISOString() },
      setWhere: inArray(whatsappReceipts.status, [...allowedPrevious[status], status]),
    });
  await reconcileWhatsAppReceipt(id);
}

export async function runWhatsAppQueue(deadline = Date.now() + 40_000) {
  const db = getDb();
  const now = new Date().toISOString();
  await db.update(whatsappMessages).set({ status: "uncertain", errorMessage: "The sender stopped without recording a result. Check WhatsApp Manager before retrying.", updatedAt: now })
    .where(and(eq(whatsappMessages.status, "sending"), lte(whatsappMessages.claimedAt, new Date(Date.now() - 10 * 60_000).toISOString())));
  // Repair the gap if checkout was saved but the server stopped before queuing
  // its confirmation. Only explicitly opted-in, confirmed orders qualify.
  const missing = await db.select({ id: orders.id }).from(orders).where(and(isNotNull(orders.whatsappConsentAt), inArray(orders.whatsappConsentSource, CHECKOUT_WHATSAPP_SOURCES), isNull(orders.whatsappOptedOutAt),
    inArray(orders.status, ["confirmed", "processing", "packaged", "dispatched"]),
    sql`(${orders.paymentMethod} = 'cash_on_delivery' OR ${orders.paymentStatus} = 'paid')`,
    sql`NOT EXISTS (SELECT 1 FROM whatsapp_messages existing WHERE existing.dedupe_key = 'confirmation:' || ${orders.id}::text OR (existing.order_id = ${orders.id} AND existing.kind = 'activation'))`)).limit(50);
  for (const order of missing) {
    if (Date.now() > deadline - 22_000) break;
    await confirmOrderWhatsApp(order.id);
  }
  const pending = await db.select({ id: whatsappMessages.id }).from(whatsappMessages).where(and(eq(whatsappMessages.status, "pending"), lte(whatsappMessages.nextAttemptAt, now)))
    .orderBy(whatsappMessages.nextAttemptAt).limit(50);
  const results = [];
  for (const message of pending) {
    if (Date.now() > deadline - 22_000) break;
    results.push({ id: message.id, ...await dispatchWhatsApp(message.id) });
  }
  return { recoveredConfirmations: missing.length, checked: pending.length, results };
}
