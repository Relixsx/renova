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
  const legacy = await db.select().from(schema.orders);
  assert.equal(legacy.length, 1); assert.equal(legacy[0].orderNumber, "REN-LEGACY"); assert.equal(legacy[0].whatsappConsentAt, null);
  assert.equal((await db.select().from(schema.orderReminders))[0].whatsappEnabled, false);
  assert.equal((await db.select().from(schema.orderReminderLogs)).length, 1);
});

beforeEach(async () => {
  await pg.exec("TRUNCATE whatsapp_messages,whatsapp_receipts,order_reminder_logs,order_reminders,orders RESTART IDENTITY");
  globalThis[symbol] = db;
  globalThis[productsSymbol] = [{ slug: "qa-headphones", name: "Headphones", sku: "QA-001", variants: ["Black"], imageUrl: "/qa.svg", isPublished: true, stock: 20, paymentMode: "cash_on_delivery", priceKobo: 2450000 }];
  Object.assign(process.env, { WHATSAPP_AUTOMATION_ENABLED: "true", WHATSAPP_ACCESS_TOKEN: "fake-db-test-token", WHATSAPP_PHONE_NUMBER_ID: "123456", WHATSAPP_REMINDER_TEMPLATE: "renova_delivery_update", WHATSAPP_TEMPLATE_LANGUAGE: "en", WHATSAPP_GRAPH_API_VERSION: "v25.0", WHATSAPP_APP_SECRET: "fake-app-secret", WHATSAPP_WEBHOOK_VERIFY_TOKEN: "fake-verify-token", REMINDER_CRON_SECRET: "fake-cron-secret", PAYSTACK_SECRET_KEY: "fake-paystack-key", RESEND_API_KEY: "fake-resend-key", RESEND_FROM_EMAIL: "qa@example.invalid", FORMSPREE_ENDPOINT: "https://forms.example.invalid/qa", APP_URL: "https://renova.example.invalid" });
  calls = []; graphBehavior = undefined;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url: String(url), body });
    if (String(url).startsWith("https://graph.facebook.com/")) return graphBehavior ? graphBehavior(body) : Response.json({ messages: [{ id: `wamid.qa-${calls.length}` }] });
    if (String(url) === "https://api.paystack.co/transaction/initialize") return Response.json({ status: true, data: { authorization_url: "https://paystack.example.invalid/qa" } });
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
