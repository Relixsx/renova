import assert from "node:assert/strict";
import { test, before, beforeEach, after } from "node:test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";

const build = process.env.RENOVA_TEST_BUILD, root = process.env.RENOVA_TEST_SOURCE;
const load = (name) => import(pathToFileURL(join(build, name.replace(/\.ts$/, ".mjs"))));
const schema = await load("db/schema.ts");
const wa = await load("app/lib/whatsapp-notifications.ts");
const controls = await load("app/lib/whatsapp-order-controls.ts");
const reminderRoute = await load("app/api/orders/reminders/route.ts");
const reminders = await load("app/lib/customer-reminders.ts");
const payments = await load("app/lib/order-payment.ts");
const webhook = await load("app/api/whatsapp/webhook/route.ts");
const codCheckout = await load("app/api/checkout/place-order/route.ts");
const prepaidCheckout = await load("app/api/checkout/initialize/route.ts");
const cron = await load("app/api/orders/reminders/run/route.ts");
const pg = new PGlite();
const db = drizzle(pg, { schema });
const symbol = Symbol.for("renova-whatsapp-test-db");
const originalFetch = globalThis.fetch;
let calls, graphBehavior;
const productsSymbol = Symbol.for("renova-whatsapp-test-products");
const journal = JSON.parse(await readFile(join(root, "drizzle-neon/meta/_journal.json"), "utf8"));

async function migrateOriginal(database) {
  for (const entry of journal.entries.slice(0, 6)) await database.exec(await readFile(join(root, `drizzle-neon/${entry.tag}.sql`), "utf8"));
}

before(async () => {
  await migrateOriginal(pg);
  await pg.exec("INSERT INTO orders (order_number,customer_name,customer_email,customer_phone,total_kobo,items_json,address_json,shipping_json) VALUES ('REN-LEGACY','Example Customer','qa@example.invalid','08000000000',10000,'[]','{}','{}'); INSERT INTO order_reminders (order_id,active,consent_confirmed,whatsapp_enabled) VALUES (1,true,true,false); INSERT INTO order_reminder_logs (order_id,reminder_id,channel,status) VALUES (1,1,'email','sent');");
  await pg.exec(await readFile(join(root, "drizzle-neon/0006_whatsapp_order_updates.sql"), "utf8"));
  await pg.exec(await readFile(join(root, "drizzle-neon/0007_editable_reminder_messages.sql"), "utf8"));
  const legacy = await db.select().from(schema.orders);
  assert.equal(legacy.length, 1); assert.equal(legacy[0].orderNumber, "REN-LEGACY"); assert.equal(legacy[0].whatsappConsentAt, null);
  assert.equal((await db.select().from(schema.orderReminders))[0].whatsappEnabled, false);
  assert.equal((await db.select().from(schema.orderReminderLogs)).length, 1);
});

beforeEach(async () => {
  await pg.exec("TRUNCATE reminder_message_settings,whatsapp_messages,whatsapp_receipts,order_reminder_logs,order_reminders,orders RESTART IDENTITY");
  globalThis[symbol] = db;
  globalThis[productsSymbol] = [{ slug: "qa-headphones", name: "Headphones", sku: "QA-001", variants: ["Black"], imageUrl: "/qa.svg", isPublished: true, stock: 20, paymentMode: "cash_on_delivery", priceKobo: 2450000 }];
  Object.assign(process.env, { WHATSAPP_AUTOMATION_ENABLED: "true", WHATSAPP_ACCESS_TOKEN: "fake-db-test-token", WHATSAPP_PHONE_NUMBER_ID: "123456", WHATSAPP_REMINDER_TEMPLATE: "renova_delivery_update", WHATSAPP_TEMPLATE_LANGUAGE: "en", WHATSAPP_GRAPH_API_VERSION: "v25.0", WHATSAPP_APP_SECRET: "fake-app-secret", WHATSAPP_WEBHOOK_VERIFY_TOKEN: "fake-verify-token", REMINDER_CRON_SECRET: "fake-cron-secret", PAYSTACK_SECRET_KEY: "fake-paystack-key", TERMII_API_KEY: "", RESEND_API_KEY: "fake-resend-key", RESEND_FROM_EMAIL: "qa@example.invalid", FORMSPREE_ENDPOINT: "https://forms.example.invalid/qa", APP_URL: "https://renova.example.invalid" });
  calls = []; graphBehavior = undefined;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url: String(url), body });
    if (String(url).startsWith("https://graph.facebook.com/")) return graphBehavior ? graphBehavior(body) : Response.json({ messages: [{ id: `wamid.qa-${calls.length}` }] });
    if (String(url) === "https://api.paystack.co/transaction/initialize") return Response.json({ status: true, data: { authorization_url: "https://paystack.example.invalid/qa" } });
    if (String(url) === "https://v3.api.termii.com/api/sms/send") return Response.json({ message_id: "qa-sms" });
    if (String(url) === "https://api.resend.com/emails") return Response.json({ id: "qa-email" });
    if (String(url) === "https://forms.example.invalid/qa") return Response.json({ ok: true });
    throw new Error("Tests block all unexpected outbound requests");
  };
});
after(async () => { globalThis.fetch = originalFetch; delete globalThis[symbol]; delete globalThis[productsSymbol]; await pg.close(); });

async function createOrder(overrides = {}) {
  const [order] = await db.insert(schema.orders).values({ orderNumber: `REN-QA-${crypto.randomUUID().slice(0, 8)}`, customerName: "Amina Example", customerEmail: "qa@example.invalid", customerPhone: "08000000000", status: "confirmed", paymentMethod: "cash_on_delivery", paymentStatus: "payment_due_on_delivery", totalKobo: 2450000, itemsJson: '[{"name":"Headphones","quantity":1}]', addressJson: "{}", shippingJson: "{}", estimatedDelivery: "24–26 October", ...wa.checkoutWhatsAppConsent(true, "08000000000"), ...overrides }).returning();
  return order;
}
const graphCalls = () => calls.filter((call) => call.url.startsWith("https://graph.facebook.com/"));
const allMessages = () => db.select().from(schema.whatsappMessages);

test("database unique keys and atomic claims deduplicate concurrent confirmations", async () => {
  const order = await createOrder();
  await Promise.all([wa.confirmOrderWhatsApp(order.id), wa.confirmOrderWhatsApp(order.id), wa.confirmOrderWhatsApp(order.id)]);
  assert.equal(graphCalls().length, 1); assert.equal((await allMessages()).length, 1); assert.equal((await allMessages())[0].status, "accepted");
  const [reminder] = await db.select().from(schema.orderReminders);
  assert.equal(reminder.active, true); assert.equal(reminder.emailEnabled, false); assert.ok(Date.parse(reminder.nextSendAt) >= Date.now() + 23.99 * 3600_000);
  await wa.runWhatsAppQueue(); assert.equal(graphCalls().length, 1);
});

test("strict opt-in and payment verification exclude historical, unchecked and unpaid orders", async () => {
  assert.deepEqual(wa.checkoutWhatsAppConsent("true", "not-a-number"), {});
  for (const overrides of [{ whatsappConsentAt: null, whatsappPhone: null, whatsappConsentSource: null }, { status: "payment_pending", paymentMethod: "paystack", paymentStatus: "pending" }]) {
    const order = await createOrder(overrides); await wa.confirmOrderWhatsApp(order.id);
  }
  await wa.runWhatsAppQueue(); assert.equal(graphCalls().length, 0); assert.equal((await allMessages()).length, 0);
});

test("a saved checkout is recovered by the scheduler if the server stopped before queuing", async () => {
  await createOrder(); await wa.runWhatsAppQueue(); await wa.runWhatsAppQueue();
  assert.equal(graphCalls().length, 1); assert.equal((await allMessages())[0].kind, "confirmation");
});

test("repeated payment verification sends one WhatsApp confirmation after payment is verified", async () => {
  const order = await createOrder({ status: "payment_pending", paymentStatus: "pending", paymentMethod: "paystack" });
  await wa.confirmOrderWhatsApp(order.id); assert.equal(graphCalls().length, 0);
  await Promise.all([payments.markOrderPaid(order.orderNumber, order.totalKobo), payments.markOrderPaid(order.orderNumber, order.totalKobo)]);
  await payments.markOrderPaid(order.orderNumber, order.totalKobo);
  assert.equal(graphCalls().length, 1); assert.match(graphCalls()[0].body.template.components[0].parameters[2].text, /Payment of ₦24,500 has been received/);
});

test("concurrent cron checks send one due daily update and enforce a full 24-hour interval", async () => {
  const order = await createOrder(); await wa.confirmOrderWhatsApp(order.id);
  const yesterday = new Date(Date.now() - 25 * 3600_000).toISOString();
  await db.update(schema.whatsappMessages).set({ acceptedAt: yesterday });
  const [reminder] = await db.update(schema.orderReminders).set({ nextSendAt: yesterday }).returning();
  await db.update(schema.orders).set({ status: "dispatched" });
  await Promise.all([reminders.dispatchReminder(reminder.id), reminders.dispatchReminder(reminder.id)]);
  assert.equal(graphCalls().length, 2); assert.match(graphCalls()[1].body.template.components[0].parameters[2].text, /dispatched and is on the way/);
  await reminders.runDueReminders(); assert.equal(graphCalls().length, 2);
  // Even an accidentally advanced database schedule cannot make WhatsApp send
  // another routine update less than 24 hours after its last accepted message.
  await db.update(schema.orderReminders).set({ nextSendAt: yesterday });
  await reminders.runDueReminders(); assert.equal(graphCalls().length, 2);
});

test("an outage coalesces pending daily jobs instead of replaying a backlog", async () => {
  const order = await createOrder(); await wa.confirmOrderWhatsApp(order.id);
  const [reminder] = await db.select().from(schema.orderReminders);
  const jobs = await Promise.all([wa.enqueueWhatsApp(order.id, reminder.id, "routine", "day-a"), wa.enqueueWhatsApp(order.id, reminder.id, "routine", "day-b")]);
  assert.equal(jobs[0].id, jobs[1].id);
  assert.equal((await allMessages()).filter((message) => message.kind === "routine").length, 1);
});

test("older customers can be enrolled manually with consent without an extra new-order confirmation", async () => {
  const order = await createOrder({ whatsappConsentAt: null, whatsappPhone: null, whatsappConsentSource: null });
  const input = { orderId: order.id, consentConfirmed: false, emailEnabled: false, whatsappEnabled: true, smsEnabled: false, currentCheckpoint: "Parcel received at the delivery hub.", deliveryEstimate: "24–26 October", customerNote: "", start: true };
  await assert.rejects(reminders.saveReminder(input), /consent/);
  const reminder = await reminders.saveReminder({ ...input, consentConfirmed: true });
  await reminders.dispatchReminder(reminder.id); await wa.runWhatsAppQueue();
  assert.equal(graphCalls().length, 1); assert.equal((await allMessages())[0].kind, "routine");
});

test("timeouts pause automatic retries and require an owner delivery check before retry", async () => {
  const order = await createOrder(); graphBehavior = async () => { throw new Error("simulated timeout"); };
  await wa.confirmOrderWhatsApp(order.id); const [message] = await allMessages(); assert.equal(message.status, "uncertain");
  await wa.runWhatsAppQueue(); assert.equal(graphCalls().length, 1);
  await assert.rejects(wa.retryWhatsApp(message.id, false), /Check WhatsApp Manager/);
  graphBehavior = undefined; await wa.retryWhatsApp(message.id, true);
  assert.equal(graphCalls().length, 2); assert.equal((await allMessages())[0].status, "accepted");
});

test("early receipts are retained and out-of-order receipts cannot downgrade read or delivered", async () => {
  const order = await createOrder();
  graphBehavior = async () => { await wa.recordWhatsAppStatus("wamid.early", "delivered"); return Response.json({ messages: [{ id: "wamid.early" }] }); };
  await wa.confirmOrderWhatsApp(order.id); assert.equal((await allMessages())[0].status, "delivered");
  await wa.recordWhatsAppStatus("wamid.early", "read"); await wa.recordWhatsAppStatus("wamid.early", "failed", 131026); await wa.recordWhatsAppStatus("wamid.early", "sent");
  assert.equal((await allMessages())[0].status, "read");
});

test("terminal orders and manual collection stop queued jobs without sending", async () => {
  for (const status of ["delivered", "collected", "cancelled", "refunded"]) {
    process.env.WHATSAPP_AUTOMATION_ENABLED = "false";
    const order = await createOrder(); await wa.confirmOrderWhatsApp(order.id);
    await db.update(schema.orders).set({ status }).where(eq(schema.orders.id, order.id));
    process.env.WHATSAPP_AUTOMATION_ENABLED = "true"; await wa.runWhatsAppQueue();
    assert.equal((await allMessages()).find((message) => message.orderId === order.id).status, "cancelled");
  }
  process.env.WHATSAPP_AUTOMATION_ENABLED = "false";
  const order = await createOrder(); await wa.confirmOrderWhatsApp(order.id); await reminders.stopReminder(order.id);
  process.env.WHATSAPP_AUTOMATION_ENABLED = "true"; await wa.runWhatsAppQueue(); assert.equal(graphCalls().length, 0);
});

test("STOP suppresses every current order for the same WhatsApp number and cannot be overridden by a callback", async () => {
  const one = await createOrder(), two = await createOrder();
  await wa.confirmOrderWhatsApp(one.id); await wa.confirmOrderWhatsApp(two.id);
  await wa.optOutWhatsApp("+2348000000000");
  for (const order of await db.select().from(schema.orders)) assert.ok(order.whatsappOptedOutAt);
  for (const reminder of await db.select().from(schema.orderReminders)) { assert.equal(reminder.whatsappEnabled, false); assert.equal(reminder.active, false); }
  await wa.confirmOrderWhatsApp(one.id); await wa.runWhatsAppQueue(); assert.equal(graphCalls().length, 2);
});

function signedRequest(event, signatureSecret = process.env.WHATSAPP_APP_SECRET) {
  const raw = JSON.stringify(event);
  const signature = `sha256=${createHmac("sha256", signatureSecret).update(raw).digest("hex")}`;
  return new Request("https://renova.example.invalid/api/whatsapp/webhook", { method: "POST", headers: { "x-hub-signature-256": signature }, body: raw });
}
const stopEvent = (phoneId = "123456") => ({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: phoneId }, messages: [{ from: "2348000000000", text: { body: "STOP" } }] } }] }] });

test("webhook verification, signatures and phone routing protect customer opt-outs", async () => {
  const order = await createOrder(); await wa.confirmOrderWhatsApp(order.id);
  assert.equal((await webhook.GET(new Request("https://renova.test/webhook?hub.mode=subscribe&hub.verify_token=wrong"))).status, 403);
  const verified = await webhook.GET(new Request("https://renova.test/webhook?hub.mode=subscribe&hub.verify_token=fake-verify-token&hub.challenge=1234")); assert.equal(await verified.text(), "1234");
  assert.equal((await webhook.POST(signedRequest(stopEvent(), "wrong-secret"))).status, 401);
  assert.equal((await webhook.POST(signedRequest(stopEvent("other-phone")))).status, 200); assert.equal((await db.select().from(schema.orders))[0].whatsappOptedOutAt, null);
  assert.equal((await webhook.POST(signedRequest(stopEvent()))).status, 200); assert.ok((await db.select().from(schema.orders))[0].whatsappOptedOutAt);
  assert.equal((await webhook.POST(signedRequest(stopEvent()))).status, 200);
});

test("a failed opt-out is not acknowledged so Meta can retry it", async () => {
  globalThis[symbol] = { update() { throw new Error("simulated database outage"); } };
  const response = await webhook.POST(signedRequest(stopEvent())); assert.equal(response.status, 503);
  globalThis[symbol] = db;
});

test("cron endpoint requires its private bearer secret", async () => {
  assert.equal((await cron.POST(new Request("https://renova.test/api/orders/reminders/run", { method: "POST" }))).status, 401);
  assert.equal((await cron.POST(new Request("https://renova.test/api/orders/reminders/run", { method: "POST", headers: { authorization: "Bearer fake-cron-secret" } }))).status, 200);
});

test("a SQL failure rolls back the additive migration with existing store data retained", async () => {
  const temporary = new PGlite();
  try {
    await migrateOriginal(temporary);
    await temporary.exec("INSERT INTO orders (order_number,customer_name,customer_email,customer_phone,total_kobo,items_json,address_json,shipping_json) VALUES ('REN-KEEP','Example','qa@example.invalid','08000000000',10000,'[]','{}','{}');");
    await temporary.exec("BEGIN");
    const statements = (await readFile(join(root, "drizzle-neon/0006_whatsapp_order_updates.sql"), "utf8")).split("--> statement-breakpoint");
    await temporary.exec(statements[0]); await temporary.exec(statements[1]);
    await assert.rejects(temporary.exec("ALTER TABLE missing_qa_table ADD COLUMN invalid_qa text"));
    await temporary.exec("ROLLBACK");
    assert.equal((await temporary.query("SELECT count(*)::int AS count FROM orders")).rows[0].count, 1);
    assert.equal((await temporary.query("SELECT to_regclass('public.whatsapp_messages') AS name")).rows[0].name, null);
  } finally { await temporary.close(); }
});


const checkoutDetails = { fullName: "Amina Example", email: "qa@example.invalid", phone: "08000000000", whatsappPhone: "09000000001", streetAddress: "QA Street", stateCode: "LA", lga: "Ikeja", cityTown: "Ikeja" };
const checkoutRequest = (overrides = {}) => new Request("https://renova.example.invalid/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lines: [{ slug: "qa-headphones", quantity: 1 }], deliveryId: "jumia", details: checkoutDetails, customerConfirmedDeliveryCommitment: true, whatsapp: { phone: checkoutDetails.whatsappPhone, noticeVersion: "checkout-v2" }, ...overrides }) });

test("new COD checkout automatically confirms to the separate WhatsApp number and admin saves preserve it", async () => {
  const response = await codCheckout.POST(checkoutRequest());
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const [order] = await db.select().from(schema.orders);
  assert.equal(order.customerPhone, "08000000000"); assert.equal(order.whatsappPhone, "2349000000001"); assert.equal(order.whatsappConsentSource, "checkout-v2");
  assert.equal(graphCalls().length, 1); assert.equal(graphCalls()[0].body.to, "2349000000001");
  const [reminder] = await db.select().from(schema.orderReminders);
  assert.equal(reminder.active, true); assert.equal(reminder.whatsappEnabled, true);
  await reminders.saveReminder({ ...reminder, start: true, customerNote: "Please keep your phone reachable." });
  assert.equal((await db.select().from(schema.orders))[0].whatsappPhone, "2349000000001");
  await wa.optOutWhatsApp("09000000001");
  assert.ok((await db.select().from(schema.orders))[0].whatsappOptedOutAt);
  await assert.rejects(reminders.saveReminder({ ...reminder, start: true }), /opted out/);
  await wa.runWhatsAppQueue(); assert.equal(graphCalls().length, 1);
});

test("malformed or missing WhatsApp number in the new checkout request creates no order", async () => {
  for (const whatsapp of [{ phone: "", noticeVersion: "checkout-v2" }, { phone: "123", noticeVersion: "checkout-v2" }, { noticeVersion: "checkout-v2" }, { phone: "09000000001", noticeVersion: "unknown" }, null]) {
    const response = await codCheckout.POST(checkoutRequest({ whatsapp }));
    assert.equal(response.status, 400);
  }
  assert.equal((await db.select().from(schema.orders)).length, 0); assert.equal(graphCalls().length, 0);
});

test("separate WhatsApp checkout for Paystack waits for verified payment and confirms once", async () => {
  globalThis[productsSymbol][0].paymentMode = "prepaid";
  const response = await prepaidCheckout.POST(checkoutRequest());
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const [order] = await db.select().from(schema.orders);
  assert.equal(order.whatsappPhone, "2349000000001"); assert.equal(graphCalls().length, 0);
  await wa.runWhatsAppQueue(); assert.equal(graphCalls().length, 0);
  await payments.markOrderPaid(order.orderNumber, order.totalKobo);
  await payments.markOrderPaid(order.orderNumber, order.totalKobo);
  assert.equal(graphCalls().length, 1); assert.equal(graphCalls()[0].body.to, "2349000000001");
});

test("scheduler recovers a v2 confirmation without enrolling an older unconsented order", async () => {
  await createOrder({ ...wa.checkoutWhatsAppConsent(false, "08000000000", { phone: "09000000001", noticeVersion: "checkout-v2" }) });
  await createOrder({ whatsappConsentAt: null, whatsappPhone: null, whatsappConsentSource: null });
  await wa.runWhatsAppQueue(); await wa.runWhatsAppQueue();
  assert.equal(graphCalls().length, 1); assert.equal(graphCalls()[0].body.to, "2349000000001");
});


const olderOrder = (overrides = {}) => createOrder({ whatsappPhone: null, whatsappConsentAt: null, whatsappConsentSource: null, status: "dispatched", ...overrides });
const startInput = (order, overrides = {}) => ({ orderId: order.id, phone: "09000000001", consentConfirmed: true, ...overrides });

test("owner can start a historical order immediately with recorded consent and a separate WhatsApp recipient", async () => {
  const order = await olderOrder();
  await assert.rejects(controls.startOrderWhatsApp(startInput(order, { consentConfirmed: false })), /agreement/);
  await assert.rejects(controls.startOrderWhatsApp(startInput(order, { phone: "123" })), /valid/);
  assert.equal((await allMessages()).length, 0);
  const result = await controls.startOrderWhatsApp(startInput(order));
  assert.equal(result.changed, true); assert.equal(result.delivery.status, "accepted");
  assert.equal(graphCalls().length, 1); assert.equal(graphCalls()[0].body.to, "2349000000001");
  assert.match(graphCalls()[0].body.template.components[0].parameters[2].text, /dispatched and is on the way/);
  assert.doesNotMatch(graphCalls()[0].body.template.components[0].parameters[2].text, /received and is being processed|Thank you for choosing/);
  const [saved] = await db.select().from(schema.orders);
  assert.equal(saved.whatsappConsentSource, "owner-recorded"); assert.ok(saved.whatsappConsentAt);
  assert.equal(saved.customerPhone, "08000000000");
  assert.equal((await allMessages())[0].kind, "activation");
  await wa.runWhatsAppQueue(); assert.equal(graphCalls().length, 1);
});

test("repeated and concurrent start clicks send one activation, and daily sends wait a full 24 hours", async () => {
  const order = await olderOrder();
  const results = await Promise.all([controls.startOrderWhatsApp(startInput(order)), controls.startOrderWhatsApp(startInput(order)), controls.startOrderWhatsApp(startInput(order))]);
  assert.equal(results.filter((r) => r.changed).length, 1); assert.equal(graphCalls().length, 1);
  await controls.startOrderWhatsApp(startInput(order)); assert.equal(graphCalls().length, 1);
  const [reminder] = await db.select().from(schema.orderReminders);
  assert.ok(Date.parse(reminder.nextSendAt) >= Date.now() + 23.99 * 3600_000);
  const yesterday = new Date(Date.now() - 25 * 3600_000).toISOString();
  await db.update(schema.orderReminders).set({ nextSendAt: yesterday });
  await reminders.runDueReminders(); assert.equal(graphCalls().length, 1);
  await db.update(schema.whatsappMessages).set({ acceptedAt: yesterday, nextAttemptAt: yesterday });
  await db.update(schema.orderReminders).set({ nextSendAt: yesterday });
  await reminders.runDueReminders(); assert.equal(graphCalls().length, 2);
});

test("owner pause cancels queued WhatsApp only for that order and can be resumed without changing consent", async () => {
  process.env.WHATSAPP_AUTOMATION_ENABLED = "false";
  const one = await olderOrder(), two = await olderOrder();
  await controls.startOrderWhatsApp(startInput(one)); await controls.startOrderWhatsApp(startInput(two));
  await controls.stopOrderWhatsApp(one.id);
  const messages = await allMessages();
  assert.equal(messages.find((m) => m.orderId === one.id).status, "cancelled");
  assert.equal(messages.find((m) => m.orderId === two.id).status, "pending");
  const [saved] = await db.select().from(schema.orders).where(eq(schema.orders.id, one.id));
  assert.equal(saved.whatsappOptedOutAt, null); assert.ok(saved.whatsappConsentAt);
  process.env.WHATSAPP_AUTOMATION_ENABLED = "true";
  await wa.runWhatsAppQueue(); assert.equal(graphCalls().length, 1);
  const resumed = await controls.startOrderWhatsApp(startInput(one));
  assert.equal(resumed.changed, true); assert.equal(graphCalls().length, 2);
});

test("starting and stopping WhatsApp preserves other channel choices and never sends an immediate email or SMS", async () => {
  const order = await olderOrder();
  const previous = await reminders.saveReminder({ orderId: order.id, consentConfirmed: true, emailEnabled: true, whatsappEnabled: false, smsEnabled: true, currentCheckpoint: "Verified courier hub update", deliveryEstimate: "24–26 October", customerNote: "Keep the collection code", start: true });
  await controls.startOrderWhatsApp(startInput(order));
  assert.equal(calls.length, 1); assert.equal(graphCalls().length, 1);
  const stopped = await controls.stopOrderWhatsApp(order.id);
  assert.equal(stopped.reminder.active, true); assert.equal(stopped.reminder.emailEnabled, true); assert.equal(stopped.reminder.smsEnabled, true); assert.equal(stopped.reminder.whatsappEnabled, false);
  assert.equal(stopped.reminder.currentCheckpoint, previous.currentCheckpoint); assert.equal(stopped.reminder.customerNote, previous.customerNote);
  assert.ok(stopped.reminder.nextSendAt);
  process.env.TERMII_API_KEY = "fake-sms-key";
  await db.update(schema.orderReminders).set({ nextSendAt: "2020-01-01T00:00:00.000Z" });
  await reminders.dispatchReminder(previous.id);
  assert.equal(calls.find((c) => c.url.includes("termii.com")).body.to, "2348000000000");
  assert.equal(graphCalls().length, 1);
});

test("new checkout orders remain automatic, while a stopped checkout order can resume with current progress only", async () => {
  const order = await createOrder(); await wa.confirmOrderWhatsApp(order.id);
  const already = await controls.startOrderWhatsApp(startInput(order, { phone: "08000000000", consentConfirmed: false }));
  assert.equal(already.changed, false); assert.equal(graphCalls().length, 1);
  await controls.stopOrderWhatsApp(order.id);
  const resumed = await controls.startOrderWhatsApp(startInput(order, { phone: "08000000000", consentConfirmed: false }));
  assert.equal(resumed.changed, true); assert.equal(graphCalls().length, 2);
  await wa.confirmOrderWhatsApp(order.id); await wa.runWhatsAppQueue(); assert.equal(graphCalls().length, 2);
});

test("a manually started checkout order never replays a missing new-order confirmation", async () => {
  const order = await createOrder({ status: "dispatched" });
  await controls.startOrderWhatsApp(startInput(order, { phone: "08000000000" }));
  await wa.confirmOrderWhatsApp(order.id); await wa.runWhatsAppQueue();
  assert.equal(graphCalls().length, 1); assert.equal((await allMessages())[0].kind, "activation");
});

test("STOP, unpaid and terminal orders cannot be re-enabled by the owner controls", async () => {
  const stopped = await olderOrder(); await controls.startOrderWhatsApp(startInput(stopped)); await wa.optOutWhatsApp("09000000001");
  await assert.rejects(controls.startOrderWhatsApp(startInput(stopped)), /requested STOP/);
  await assert.rejects(controls.startOrderWhatsApp(startInput(stopped, { phone: "08000000002" })), /requested STOP/);
  for (const status of ["delivered", "collected", "cancelled", "refunded", "payment_pending"]) {
    const order = await olderOrder({ status }); await assert.rejects(controls.startOrderWhatsApp(startInput(order)), /awaiting delivery/);
  }
  const unpaid = await olderOrder({ paymentMethod: "paystack", paymentStatus: "pending" });
  await assert.rejects(controls.startOrderWhatsApp(startInput(unpaid)), /verified paid/);
  assert.equal(graphCalls().length, 1);
});

test("a process failure after activation commit leaves a durable job for the scheduler", async () => {
  const order = await olderOrder();
  globalThis[symbol] = new Proxy(db, { get(target, key) { if (key === "execute") return async (...args) => { await target.execute(...args); throw new Error("simulated process stop after commit"); }; return Reflect.get(target, key); } });
  await assert.rejects(controls.startOrderWhatsApp(startInput(order)), /simulated process stop/);
  globalThis[symbol] = db;
  assert.equal((await allMessages())[0].status, "pending"); assert.equal(graphCalls().length, 0);
  await wa.runWhatsAppQueue(); await wa.runWhatsAppQueue();
  assert.equal(graphCalls().length, 1); assert.equal((await allMessages())[0].kind, "activation");
});

const controlRequest = (body, owner = true) => new Request("https://renova.example.invalid/api/orders/reminders", { method: "POST", headers: { "content-type": "application/json", ...(owner ? { "x-renova-test-owner": "yes" } : {}) }, body: JSON.stringify(body) });
test("admin route requires owner access and validates consent before any WhatsApp start", async () => {
  const order = await olderOrder();
  assert.equal((await reminderRoute.POST(controlRequest({ action: "start_whatsapp", orderId: order.id, whatsappPhone: "09000000001", consentConfirmed: true }, false))).status, 403);
  assert.equal((await reminderRoute.POST(controlRequest({ action: "start_whatsapp", orderId: order.id, whatsappPhone: "09000000001", consentConfirmed: false }))).status, 400);
  assert.equal(graphCalls().length, 0);
  const response = await reminderRoute.POST(controlRequest({ action: "start_whatsapp", orderId: order.id, whatsappPhone: "09000000001", consentConfirmed: true }));
  assert.equal(response.status, 200); const payload = await response.json();
  assert.equal(payload.contact.phone, "2349000000001"); assert.equal(payload.delivery.status, "accepted");
  assert.equal((await reminderRoute.POST(controlRequest({ action: "stop_whatsapp", orderId: order.id }))).status, 200);
  assert.equal((await reminderRoute.POST(controlRequest({ action: "stop_whatsapp", orderId: 999999 }))).status, 404);
});

const tracking = await load("app/api/orders/track/route.ts");
const trackingRequest = (order) => new Request("https://renova.example.invalid/api/orders/track", { method: "POST", body: JSON.stringify({ orderNumber: order.orderNumber, email: order.customerEmail }) });

test("COD checkout persists the state-specific estimate and uses it in confirmation, email and tracking", async () => {
  for (const [stateCode, expected] of [["LA", "3–5 working days"], ["OG", "3–12 working days"]]) {
    const response = await codCheckout.POST(checkoutRequest({ details: { ...checkoutDetails, stateCode } }));
    assert.equal(response.status, 200);
    const { orderNumber } = await response.json();
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.orderNumber, orderNumber));
    assert.equal(order.estimatedDelivery, expected);
    assert.ok(JSON.parse(order.shippingJson).detail.startsWith(expected));
    assert.equal(graphCalls().at(-1).body.template.components[0].parameters[3].text, expected);
    assert.ok(calls.filter((call) => call.url === "https://api.resend.com/emails").at(-1).body.html.includes(expected));
    const result = await tracking.POST(trackingRequest(order));
    assert.equal((await result.json()).order.estimatedDelivery, expected);
  }
});

test("prepaid checkout retains its destination estimate after verified payment and sends one confirmation", async () => {
  globalThis[productsSymbol][0].paymentMode = "prepaid";
  const response = await prepaidCheckout.POST(checkoutRequest({ details: { ...checkoutDetails, stateCode: "FC" } }));
  assert.equal(response.status, 200);
  const [order] = await db.select().from(schema.orders);
  assert.equal(order.estimatedDelivery, "3–12 working days"); assert.equal(graphCalls().length, 0);
  await payments.markOrderPaid(order.orderNumber, order.totalKobo);
  await payments.markOrderPaid(order.orderNumber, order.totalKobo);
  assert.equal(graphCalls().length, 1);
  assert.equal(graphCalls()[0].body.template.components[0].parameters[3].text, "3–12 working days");
  assert.equal((await db.select().from(schema.orders))[0].estimatedDelivery, "3–12 working days");
});

test("historical estimates refresh in tracking and immediate progress messages without rewriting courier dates", async () => {
  for (const [stateCode, estimate, expected] of [["OG", "3–5 working days", "3–12 working days"], ["LA", "3–7 working days", "3–5 working days"], ["OG", "24–26 October", "24–26 October"]]) {
    const order = await olderOrder({ orderNumber: `REN-QA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, addressJson: JSON.stringify({ stateCode }), estimatedDelivery: estimate });
    assert.equal((await (await tracking.POST(trackingRequest(order))).json()).order.estimatedDelivery, expected);
    await controls.startOrderWhatsApp(startInput(order));
    assert.equal(graphCalls().at(-1).body.template.components[0].parameters[3].text, expected);
    assert.equal((await db.select().from(schema.orders).where(eq(schema.orders.id, order.id)))[0].estimatedDelivery, estimate);
  }
});

test("daily email, SMS and WhatsApp previews use the current region for an older generic estimate", async () => {
  process.env.TERMII_API_KEY = "fake-sms-key";
  const order = await createOrder({ addressJson: '{"stateCode":"OG"}', estimatedDelivery: "3–5 working days" });
  const reminder = await reminders.saveReminder({ orderId: order.id, consentConfirmed: true, emailEnabled: true, whatsappEnabled: true, smsEnabled: true, currentCheckpoint: "", deliveryEstimate: "3–7 working days", customerNote: "", start: true });
  const preview = await reminderRoute.POST(controlRequest({ action: "preview", orderId: order.id, currentCheckpoint: "", deliveryEstimate: reminder.deliveryEstimate, customerNote: "" }));
  assert.equal(preview.status, 200);
  const previews = await preview.json();
  assert.ok(JSON.stringify(previews).includes("3–12 working days"));
  await db.update(schema.orderReminders).set({ nextSendAt: "2020-01-01T00:00:00.000Z" });
  await reminders.dispatchReminder(reminder.id);
  assert.ok(calls.find((call) => call.url === "https://api.resend.com/emails").body.html.includes("3–12 working days"));
  assert.ok(calls.find((call) => call.url.includes("termii.com")).body.sms.includes("3–12 working days"));
});

const messageSettings = await load("app/lib/reminder-message-settings.ts");
const messageContent = await load("app/lib/reminder-message-content.ts");
const defaultMessages = () => structuredClone(messageContent.DEFAULT_REMINDER_MESSAGES);
const contentText = (call) => call.body.template.components[0].parameters[2].text;

test("owner-only defaults persist separately and saving them does not send or alter schedules", async () => {
  const order = await createOrder(); await wa.confirmOrderWhatsApp(order.id);
  const before = (await db.select().from(schema.orderReminders))[0];
  const defaults = defaultMessages(); defaults.routine.message = "We are watching your delivery, {{first_name}}. {{status_update}}"; defaults.arrival.message = "Your parcel is waiting for collection. {{courier_update}}";
  assert.equal((await reminderRoute.POST(controlRequest({ action: "save_message_defaults", messageDefaults: defaults }, false))).status, 403);
  assert.equal((await db.select().from(schema.reminderMessageSettings)).length, 0);
  const response = await reminderRoute.POST(controlRequest({ action: "save_message_defaults", messageDefaults: defaults }));
  assert.equal(response.status, 200);
  assert.deepEqual(await messageSettings.reminderMessageDefaults(), defaults);
  assert.deepEqual((await db.select().from(schema.orderReminders))[0], before);
  assert.equal(graphCalls().length, 1);
});

test("per-order edits do not start a historical order or opt its customer in", async () => {
  const order = await olderOrder();
  const response = await reminderRoute.POST(controlRequest({ action: "save_message_edits", orderId: order.id, messageOverrides: { routine: { message: "We are checking your delivery." }, arrival: { message: "Please collect your parcel." } }, currentCheckpoint: "Verified progress", arrivalCheckpoint: "Verified collection point" }));
  assert.equal(response.status, 200);
  const row = (await response.json()).reminder;
  assert.equal(row.active, false); assert.equal(row.whatsappEnabled, false); assert.equal(row.consentConfirmed, false); assert.equal(row.nextSendAt, null);
  await wa.runWhatsAppQueue(); assert.equal(calls.length, 0);
  const [saved] = await db.select().from(schema.orders);
  assert.equal(saved.whatsappConsentAt, null);
});

test("concurrent edits preserve independent kinds and fields, and explicit default reset clears only its own kind", async () => {
  const order = await createOrder(); await wa.confirmOrderWhatsApp(order.id);
  const before = (await db.select().from(schema.orderReminders))[0];
  await Promise.all([
    messageSettings.saveOrderMessageEdits(order.id, { routine: { message: "Daily copy for this customer" } }),
    messageSettings.saveOrderMessageEdits(order.id, { arrival: { message: "Arrival copy for this customer" } }),
    messageSettings.saveOrderMessageEdits(order.id, { routine: { note: "Please answer the delivery call." } }),
  ]);
  let [row] = await db.select().from(schema.orderReminders);
  let edits = JSON.parse(row.messageOverridesJson);
  assert.equal(edits.routine.message, "Daily copy for this customer"); assert.equal(edits.routine.note, "Please answer the delivery call."); assert.equal(edits.arrival.message, "Arrival copy for this customer");
  assert.equal(row.nextSendAt, before.nextSendAt); assert.equal(row.active, before.active);
  await messageSettings.saveOrderMessageEdits(order.id, { routine: null });
  [row] = await db.select().from(schema.orderReminders); edits = JSON.parse(row.messageOverridesJson);
  assert.equal(edits.routine, null); assert.equal(edits.arrival.message, "Arrival copy for this customer"); assert.equal(graphCalls().length, 1);
});

test("all three previews are independent and previewing does not save, send, confirm arrival or alter a schedule", async () => {
  const order = await createOrder(); await wa.confirmOrderWhatsApp(order.id);
  const before = (await db.select().from(schema.orderReminders))[0];
  const response = await reminderRoute.POST(controlRequest({ action: "preview", orderId: order.id, messageOverrides: { routine: { message: "DAILY ONLY {{first_name}}", deliveryEstimate: "30 October" }, arrival: { message: "ARRIVAL ONLY {{courier_update}}", deliveryEstimate: "Collect before Friday 5pm" } }, arrivalCheckpoint: "Pickup desk B" }));
  assert.equal(response.status, 200); const preview = await response.json();
  assert.match(preview.preview, /DAILY ONLY Amina/); assert.doesNotMatch(preview.preview, /ARRIVAL ONLY/);
  assert.match(preview.arrivalPreview, /ARRIVAL ONLY Pickup desk B/); assert.match(preview.arrivalPreview, /Collect before Friday 5pm/);
  assert.doesNotMatch(preview.confirmationPreview, /DAILY ONLY|ARRIVAL ONLY|Friday/);
  assert.equal(preview.emailPreviews.arrival.estimate, "Collect before Friday 5pm"); assert.match(preview.smsPreviews.routine, /DAILY ONLY/);
  assert.deepEqual((await db.select().from(schema.orderReminders))[0], before); assert.equal(graphCalls().length, 1);
});

test("current order edits apply to the next WhatsApp, email and SMS, with email markup escaped", async () => {
  process.env.TERMII_API_KEY = "fake-sms-key";
  const order = await createOrder(); await wa.confirmOrderWhatsApp(order.id);
  let [row] = await db.select().from(schema.orderReminders);
  await reminders.saveReminder({ ...row, emailEnabled: true, smsEnabled: true, start: true });
  await messageSettings.saveOrderMessageEdits(order.id, { routine: { message: 'Daily note for {{first_name}}. <script>alert("x")</script>', deliveryEstimate: "30 October", note: "Keep your collection code", emailSubject: "Delivery update for {{order_number}}", emailHeading: "Your parcel update" } });
  const yesterday = new Date(Date.now() - 25 * 3600_000).toISOString();
  await db.update(schema.orderReminders).set({ nextSendAt: yesterday }); await db.update(schema.whatsappMessages).set({ acceptedAt: yesterday });
  await reminders.runDueReminders();
  assert.match(contentText(graphCalls().at(-1)), /Daily note for Amina/); assert.equal(graphCalls().at(-1).body.template.components[0].parameters[3].text, "30 October");
  const email = calls.filter((call) => call.url === "https://api.resend.com/emails").at(-1).body;
  assert.equal(email.subject, `Delivery update for ${order.orderNumber}`); assert.match(email.html, /Your parcel update/); assert.match(email.html, /&lt;script&gt;/); assert.doesNotMatch(email.html, /<script>/);
  assert.match(calls.find((call) => call.url.includes("termii.com")).body.sms, /Daily note for Amina/);
});

test("editing a not-yet-queued checkout preserves automatic confirmation recovery without applying daily wording to it", async () => {
  const order = await createOrder();
  await messageSettings.saveOrderMessageEdits(order.id, { routine: { message: "DAILY CUSTOM COPY" } });
  assert.equal((await db.select().from(schema.orderReminders))[0].active, false);
  await wa.runWhatsAppQueue();
  assert.equal(graphCalls().length, 1); assert.match(contentText(graphCalls()[0]), /Thank you for choosing Renova/); assert.doesNotMatch(contentText(graphCalls()[0]), /DAILY CUSTOM/);
});

test("arrival requires explicit verified information and repeated concurrent clicks send one immediate arrival update", async () => {
  const order = await createOrder({ status: "dispatched" }); await wa.confirmOrderWhatsApp(order.id);
  const body = { action: "activate_arrival", orderId: order.id, arrivalConfirmed: true, arrivalCheckpoint: "Collect at Desk B with your courier code", messageOverrides: { arrival: { message: "ARRIVED: {{courier_update}}", deliveryEstimate: "Collect by Friday 5pm" } } };
  for (const invalid of [{ ...body, arrivalConfirmed: false }, { ...body, arrivalCheckpoint: "" }]) assert.equal((await reminderRoute.POST(controlRequest(invalid))).status, 400);
  assert.equal((await db.select().from(schema.orderReminders))[0].reminderPhase, "delivery"); assert.equal(graphCalls().length, 1);
  const results = await Promise.all([reminderRoute.POST(controlRequest(body)), reminderRoute.POST(controlRequest(body)), reminderRoute.POST(controlRequest(body))]);
  for (const response of results) assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.equal(graphCalls().length, 2); assert.match(contentText(graphCalls().at(-1)), /ARRIVED: Collect at Desk B/); assert.doesNotMatch(contentText(graphCalls().at(-1)), /on the way|Thank you for choosing Renova!/);
  const [row] = await db.select().from(schema.orderReminders);
  assert.equal(row.reminderPhase, "arrival"); assert.ok(row.arrivalConfirmedAt); assert.ok(row.arrivalAnnouncedAt); assert.ok(Date.parse(row.nextSendAt) >= Date.now() + 23.99 * 3600_000);
  assert.equal((await allMessages()).filter((message) => message.kind === "arrival").length, 1);
});

test("verified arrival reminders repeat after a full 24 hours and stop on collection", async () => {
  const order = await createOrder({ status: "dispatched" }); await wa.confirmOrderWhatsApp(order.id);
  await messageSettings.saveOrderMessageEdits(order.id, { arrival: { message: "Your parcel is ready for collection. {{courier_update}}" } });
  await reminderRoute.POST(controlRequest({ action: "activate_arrival", orderId: order.id, arrivalConfirmed: true, arrivalCheckpoint: "Pickup desk B" }));
  assert.equal(graphCalls().length, 2);
  await db.update(schema.orderReminders).set({ nextSendAt: "2020-01-01T00:00:00.000Z" });
  await reminders.runDueReminders(); assert.equal(graphCalls().length, 2);
  const yesterday = new Date(Date.now() - 25 * 3600_000).toISOString();
  await db.update(schema.whatsappMessages).set({ acceptedAt: yesterday, nextAttemptAt: "2020-01-01T00:00:00.000Z" });
  await db.update(schema.orderReminders).set({ nextSendAt: yesterday });
  await Promise.all([reminders.runDueReminders(), reminders.runDueReminders()]);
  assert.equal(graphCalls().length, 3); assert.match(contentText(graphCalls().at(-1)), /ready for collection.*Pickup desk B/);
  assert.equal((await allMessages()).filter((message) => message.kind === "arrival_reminder" && message.status === "accepted").length, 1);
  await db.update(schema.orders).set({ status: "collected" }); await db.update(schema.orderReminders).set({ nextSendAt: yesterday });
  await reminders.runDueReminders(); assert.equal(graphCalls().length, 3); assert.equal((await db.select().from(schema.orderReminders))[0].active, false);
});

test("arrival wording changes do not resume paused notifications or override STOP", async () => {
  const order = await createOrder({ status: "dispatched" }); await wa.confirmOrderWhatsApp(order.id); await controls.stopOrderWhatsApp(order.id);
  await messageSettings.saveOrderMessageEdits(order.id, { arrival: { message: "Ready for pickup now" } });
  await messageSettings.confirmOrderArrival(order.id, "Verified pickup desk", true);
  await reminders.runDueReminders(); assert.equal(graphCalls().length, 1);
  await controls.startOrderWhatsApp(startInput(order, { phone: "08000000000" }));
  assert.equal(graphCalls().length, 2); assert.match(contentText(graphCalls().at(-1)), /Ready for pickup now/);
  await wa.optOutWhatsApp("08000000000"); await messageSettings.saveOrderMessageEdits(order.id, { arrival: { note: "Please collect this week" } });
  await assert.rejects(controls.startOrderWhatsApp(startInput(order, { phone: "08000000000" })), /requested STOP/);
  assert.equal(graphCalls().length, 2);
});

test("a crash after the arrival transition is recovered by the scheduler with one arrival message", async () => {
  const order = await createOrder({ status: "dispatched" }); await wa.confirmOrderWhatsApp(order.id);
  globalThis[symbol] = new Proxy(db, { get(target, key) { if (key === "execute") return async (...args) => { await target.execute(...args); throw new Error("simulated stop after arrival commit"); }; return Reflect.get(target, key); } });
  await assert.rejects(messageSettings.confirmOrderArrival(order.id, "Verified collection point", true), /simulated stop/);
  globalThis[symbol] = db;
  await reminders.runDueReminders(); await reminders.runDueReminders();
  assert.equal(graphCalls().length, 2); assert.match(contentText(graphCalls().at(-1)), /arrived and is ready for collection/);
});

test("invalid message edits and oversized requests change no data and send nothing", async () => {
  const order = await createOrder();
  for (const messageOverrides of [{ confirmation: { message: "Edit initial confirmation" } }, { routine: { message: "{{unsupported}}" } }, { arrival: { note: "A".repeat(81) } }]) assert.equal((await reminderRoute.POST(controlRequest({ action: "save_message_edits", orderId: order.id, messageOverrides }))).status, 400);
  const response = await reminderRoute.POST(controlRequest({ action: "save_message_defaults", messageDefaults: { routine: { message: "A".repeat(17000) } } }));
  assert.equal(response.status, 413);
  assert.equal((await db.select().from(schema.orderReminders)).length, 0); assert.equal((await db.select().from(schema.reminderMessageSettings)).length, 0); assert.equal(calls.length, 0);
});

test("an older delivery send finishing after an arrival transition cannot postpone or falsely announce arrival", async () => {
  const order = await createOrder({ status: "dispatched" }); await wa.confirmOrderWhatsApp(order.id);
  const yesterday = new Date(Date.now() - 25 * 3600_000).toISOString();
  await db.update(schema.whatsappMessages).set({ acceptedAt: yesterday }); await db.update(schema.orderReminders).set({ nextSendAt: yesterday });
  let releaseSend, enteredSend;
  const blocked = new Promise((resolve) => { releaseSend = resolve; });
  const entered = new Promise((resolve) => { enteredSend = resolve; });
  graphBehavior = async () => { enteredSend(); await blocked; return Response.json({ messages: [{ id: "wamid.inflight-daily" }] }); };
  const oldSend = reminders.runDueReminders();
  await entered;
  await messageSettings.confirmOrderArrival(order.id, "Verified pickup desk", true);
  releaseSend(); await oldSend; graphBehavior = undefined;
  const [waiting] = await db.select().from(schema.orderReminders);
  assert.equal(waiting.reminderPhase, "arrival"); assert.equal(waiting.arrivalAnnouncedAt, null); assert.ok(Date.parse(waiting.nextSendAt) <= Date.now());
  await reminders.runDueReminders();
  assert.equal(graphCalls().length, 3); assert.match(contentText(graphCalls().at(-1)), /arrived and is ready for collection/);
});

async function onClock(iso, action) {
  const OriginalDate = globalThis.Date;
  const milliseconds = OriginalDate.parse(iso);
  class ClockDate extends OriginalDate {
    constructor(...args) { if (args.length) super(...args); else super(milliseconds); }
    static now() { return milliseconds; }
  }
  globalThis.Date = ClockDate;
  try { return await action(); } finally { globalThis.Date = OriginalDate; }
}

test("saving Jumia dates changes only that order's daily countdown and leaves confirmation and schedule intact", async () => {
  await onClock("2026-10-27T11:00:00Z", async () => {
    const order = await createOrder({ addressJson: '{"stateCode":"LA"}', estimatedDelivery: "3–5 working days" }); await wa.confirmOrderWhatsApp(order.id);
    const first = structuredClone(graphCalls()[0].body); const [before] = await db.select().from(schema.orderReminders);
    const response = await reminderRoute.POST(controlRequest({ action: "save_message_edits", orderId: order.id, jumiaDeliveryWindow: { from: "2026-11-01", to: "2026-11-03" } }));
    assert.equal(response.status, 200); const row = (await response.json()).reminder;
    assert.equal(row.jumiaDeliveryFrom, "2026-11-01"); assert.equal(row.jumiaDeliveryTo, "2026-11-03"); assert.equal(row.nextSendAt, before.nextSendAt); assert.equal(row.reminderPhase, "delivery");
    assert.equal(graphCalls().length, 1); assert.deepEqual(graphCalls()[0].body, first);
    assert.equal((await db.select().from(schema.orders))[0].estimatedDelivery, "3–5 working days");
    const preview = await (await reminderRoute.POST(controlRequest({ action: "preview", orderId: order.id }))).json();
    assert.match(preview.preview, /expected in 5–7 days/); assert.match(preview.preview, /1–3 November 2026/);
    assert.doesNotMatch(preview.confirmationPreview, /November|5–7 days/); assert.equal(graphCalls().length, 1);
  });
});

test("scheduled WhatsApp, email and SMS recompute the window on each actual day and never auto-confirm arrival", async () => {
  let order;
  await onClock("2026-10-27T11:00:00Z", async () => {
    order = await createOrder({ status: "dispatched", estimatedDelivery: "3–5 working days" }); await wa.confirmOrderWhatsApp(order.id);
    let [row] = await db.select().from(schema.orderReminders); await reminders.saveReminder({ ...row, emailEnabled: true, smsEnabled: true, start: true });
    await messageSettings.saveOrderMessageEdits(order.id, {}, undefined, undefined, { from: "2026-11-01", to: "2026-11-03" });
  });
  process.env.TERMII_API_KEY = "fake-sms-key";
  const days = [["2026-10-28", /in 4–6 days/], ["2026-10-29", /in 3–5 days/], ["2026-10-31", /in 1–3 days/], ["2026-11-01", /today or within the next 2 days/], ["2026-11-03", /expected today/], ["2026-11-04", /window has passed/]];
  for (const [day, expected] of days) {
    await onClock(`${day}T11:00:00Z`, async () => {
      const before = graphCalls().length; await reminders.runDueReminders();
      assert.equal(graphCalls().length, before + 1, day); assert.match(contentText(graphCalls().at(-1)), expected);
      assert.match(calls.filter((call) => call.url === "https://api.resend.com/emails").at(-1).body.html, expected);
      assert.match(calls.filter((call) => call.url.includes("termii.com")).at(-1).body.sms, expected);
      assert.equal((await db.select().from(schema.orderReminders))[0].arrivalConfirmedAt, null);
      assert.equal((await allMessages()).filter((message) => ["arrival", "arrival_reminder"].includes(message.kind)).length, 0);
    });
  }
});

test("revised or cleared Jumia dates apply to future reminders without sending immediately or changing another order", async () => {
  await onClock("2026-10-27T11:00:00Z", async () => {
    const one = await createOrder(), two = await createOrder(); await wa.confirmOrderWhatsApp(one.id); await wa.confirmOrderWhatsApp(two.id);
    await messageSettings.saveOrderMessageEdits(one.id, {}, undefined, undefined, { from: "2026-11-01", to: "2026-11-03" });
    const [before] = await db.select().from(schema.orderReminders).where(eq(schema.orderReminders.orderId, one.id));
    await messageSettings.saveOrderMessageEdits(one.id, {}, undefined, undefined, { from: "2026-11-03", to: "2026-11-04" });
    const preview = await (await reminderRoute.POST(controlRequest({ action: "preview", orderId: one.id }))).json(); assert.match(preview.preview, /in 7–8 days/);
    assert.equal((await db.select().from(schema.orderReminders).where(eq(schema.orderReminders.orderId, one.id)))[0].nextSendAt, before.nextSendAt);
    assert.equal((await db.select().from(schema.orderReminders).where(eq(schema.orderReminders.orderId, two.id)))[0].jumiaDeliveryFrom, null);
    await messageSettings.saveOrderMessageEdits(one.id, {}, undefined, undefined, null);
    const cleared = await (await reminderRoute.POST(controlRequest({ action: "preview", orderId: one.id }))).json(); assert.doesNotMatch(cleared.preview, /November|in \d+–\d+ days/);
    assert.equal(graphCalls().length, 2);
  });
});

test("invalid Jumia ranges cause no partial edits, and previewing an unsaved valid window has no side effects", async () => {
  const order = await olderOrder();
  for (const jumiaDeliveryWindow of [{ from: "2026-02-30" }, { from: "2026-11-03", to: "2026-11-01" }, { from: "", to: "2026-11-01" }]) {
    const response = await reminderRoute.POST(controlRequest({ action: "save_message_edits", orderId: order.id, messageOverrides: { routine: { message: "Do not save this partial edit" } }, jumiaDeliveryWindow })); assert.equal(response.status, 400);
  }
  assert.equal((await db.select().from(schema.orderReminders)).length, 0); assert.equal(calls.length, 0);
  await onClock("2026-10-27T11:00:00Z", async () => {
    const response = await reminderRoute.POST(controlRequest({ action: "preview", orderId: order.id, jumiaDeliveryWindow: { from: "2026-11-01", to: "2026-11-03" } }));
    assert.equal(response.status, 200);
    const preview = (await response.json()).preview;
    assert.match(preview, /Hello Amina,/); assert.ok(preview.includes(order.orderNumber));
    assert.match(preview, /in 5–7 days/); assert.match(preview, /1 × Headphones/); assert.match(preview, /₦24,500/);
    assert.doesNotMatch(preview, /{{|Your daily delivery update:/);
  });
  assert.equal((await db.select().from(schema.orderReminders)).length, 0); assert.equal(calls.length, 0);
});

test("a separately verified early arrival replaces the saved Jumia countdown immediately", async () => {
  await onClock("2026-10-27T11:00:00Z", async () => {
    const order = await createOrder({ status: "dispatched" }); await wa.confirmOrderWhatsApp(order.id);
    await messageSettings.saveOrderMessageEdits(order.id, {}, undefined, undefined, { from: "2026-11-01", to: "2026-11-03" });
    const response = await reminderRoute.POST(controlRequest({ action: "activate_arrival", orderId: order.id, arrivalConfirmed: true, arrivalCheckpoint: "Verified early arrival at the pickup desk" }));
    assert.equal(response.status, 200); assert.equal(graphCalls().length, 2);
    assert.match(contentText(graphCalls().at(-1)), /has arrived and is ready for collection/); assert.doesNotMatch(contentText(graphCalls().at(-1)), /in 5–7 days|payment ready/);
    assert.equal(graphCalls().at(-1).body.template.components[0].parameters[3].text, "Ready for collection now");
  });
});

test("the customer's 6–10 November window counts down from 9–13 to 8–12 to 7–11 days without another edit", async () => {
  let order;
  const custom = "Please plan ahead for your delivery. We will let you know when your parcel is ready.";
  await onClock("2026-10-27T08:30:00Z", async () => {
    order = await createOrder({ createdAt: "2026-10-20T08:30:00Z", addressJson: '{"stateCode":"LA"}', estimatedDelivery: "3–5 working days" });
    await wa.confirmOrderWhatsApp(order.id);
    const response = await reminderRoute.POST(controlRequest({ action: "save_message_edits", orderId: order.id, messageOverrides: { routine: { message: custom } }, jumiaDeliveryWindow: { from: "2026-11-06", to: "2026-11-10" } }));
    assert.equal(response.status, 200); assert.equal(graphCalls().length, 1);
  });
  for (const [date, expected] of [["2026-10-28", /expected in 9–13 days/], ["2026-10-29", /expected in 8–12 days/], ["2026-10-30", /expected in 7–11 days/]]) {
    await onClock(`${date}T08:30:00Z`, async () => {
      const response = await reminderRoute.POST(controlRequest({ action: "preview", orderId: order.id })); const preview = await response.json();
      assert.match(preview.preview, expected); assert.ok(preview.preview.includes(custom));
      assert.doesNotMatch(preview.confirmationPreview, /November|days\. Please plan/);
      assert.equal(preview.previewNigeriaDate, date);
      const before = graphCalls().length; await reminders.runDueReminders();
      assert.equal(graphCalls().length, before + 1); assert.match(contentText(graphCalls().at(-1)), expected); assert.ok(contentText(graphCalls().at(-1)).includes(custom));
      const [row] = await db.select().from(schema.orderReminders);
      assert.equal(row.jumiaDeliveryFrom, "2026-11-06"); assert.equal(row.jumiaDeliveryTo, "2026-11-10"); assert.equal(row.reminderPhase, "delivery");
    });
  }
});

test("a daily job queued before Nigeria midnight uses the current countdown when it is actually sent", async () => {
  let queued;
  await onClock("2026-10-27T08:30:00Z", async () => {
    const order = await createOrder(); await wa.confirmOrderWhatsApp(order.id);
    await messageSettings.saveOrderMessageEdits(order.id, { routine: { message: "Your delivery reminder is here." } }, undefined, undefined, { from: "2026-11-06", to: "2026-11-10" });
    const [row] = await db.select().from(schema.orderReminders);
    await onClock("2026-10-28T22:59:00Z", async () => { queued = await wa.enqueueWhatsApp(order.id, row.id, "routine", "queued-before-midnight"); });
  });
  await onClock("2026-10-28T23:00:05Z", async () => {
    await wa.dispatchWhatsApp(queued.id);
    assert.equal(graphCalls().length, 2); assert.match(contentText(graphCalls().at(-1)), /expected in 8–12 days/);
    assert.doesNotMatch(contentText(graphCalls().at(-1)), /expected in 9–13 days/);
  });
});
