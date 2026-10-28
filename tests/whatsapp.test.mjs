import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const load = (name) => import(pathToFileURL(join(process.env.RENOVA_TEST_BUILD, `app/lib/${name}.mjs`)));
const { whatsappTemplateParameters, whatsappPreview, phoneForWhatsApp, confirmedOrder, isWhatsAppStop } = await load("whatsapp-message");
const { deliverQueuedWhatsApp, whatsappSettings } = await load("whatsapp-delivery");
const { verifyWhatsAppSignature, limitedWebhookBody } = await load("whatsapp-webhook-security");
const order = { customerName: "Amina Example", orderNumber: "REN-QA-001", customerPhone: "08000000000", status: "confirmed", paymentMethod: "cash_on_delivery", paymentStatus: "payment_due_on_delivery", totalKobo: 2450000, itemsJson: '[{"name":"Wireless headphones","quantity":2}]', estimatedDelivery: "24–26 October" };
const reminder = { currentCheckpoint: "", customerNote: "", deliveryEstimate: "" };
const settings = { enabled: true, token: "fake-unit-test-token", phoneId: "123456", template: "renova_delivery_update", language: "en", version: "v25.0" };

function memoryStore(overrides = {}) {
  const row = { id: 1, status: "pending", attempts: 0, nextAttemptAt: "2020-01-01T00:00:00.000Z", eligible: true, to: "2348000000000", parameters: whatsappTemplateParameters(order, reminder, "confirmation"), ...overrides };
  return { row,
    async load() { return { ...row }; },
    async claim() { if (row.status !== "pending") return false; row.status = "sending"; row.attempts++; return true; },
    async finish(_id, patch) { Object.assign(row, patch); },
  };
}

test("normalizes Nigerian national and international numbers and rejects malformed input", () => {
  for (const number of ["0800 000 0000", "+234 800 000 0000", "002348000000000", "8000000000"]) assert.equal(phoneForWhatsApp(number), "2348000000000");
  assert.equal(phoneForWhatsApp("+44 7700 900123"), "447700900123");
  for (const bad of ["", "123", "080000000000", "23408000000000", "phone8000000000", "2348000000000?token=x"]) assert.throws(() => phoneForWhatsApp(bad));
});

test("real confirmation contains the items, amount and estimate without test text or a printed STOP line", () => {
  const parameters = whatsappTemplateParameters(order, reminder, "confirmation");
  assert.equal(parameters.length, 4); assert.equal(parameters[0], "Amina"); assert.equal(parameters[1], "REN-QA-001");
  assert.match(parameters[2], /2 × Wireless headphones/); assert.match(parameters[2], /₦24,500/); assert.doesNotMatch(parameters[2], /Reply STOP/);
  assert.equal(parameters[3], "24–26 October");
  assert.doesNotMatch(whatsappPreview(parameters), /connection test|not applicable|REN-TEST|on the way|has been dispatched/i);
});

test("preparation and dispatch use different truthful wording; verified notes are included", () => {
  const preparation = whatsappTemplateParameters({ ...order, status: "processing" }, reminder, "routine")[2];
  assert.match(preparation, /being prepared/); assert.doesNotMatch(preparation, /on the way/);
  const transit = whatsappTemplateParameters({ ...order, status: "dispatched" }, reminder, "routine")[2];
  assert.match(transit, /dispatched and is on the way/);
  const arrival = whatsappTemplateParameters(order, { ...reminder, currentCheckpoint: "Ready for collection at the courier pickup point.", customerNote: "Bring your collection code." }, "arrival")[2];
  assert.match(arrival, /Ready for collection/); assert.match(arrival, /Bring your collection code/);
});

test("unpaid and completed orders are excluded and payment wording never assumes an unpaid order is paid", () => {
  assert.equal(confirmedOrder(order), true);
  for (const status of ["payment_pending", "delivered", "collected", "cancelled", "refunded"]) assert.equal(confirmedOrder({ ...order, status }), false);
  assert.equal(confirmedOrder({ ...order, paymentMethod: "paystack", paymentStatus: "pending" }), false);
  assert.equal(confirmedOrder({ ...order, paymentMethod: "paystack", paymentStatus: "paid" }), true);
});

test("template parameters have no line breaks and long input stays within the body limit", () => {
  const parameters = whatsappTemplateParameters({ ...order, customerName: "A".repeat(800), orderNumber: "B".repeat(800), estimatedDelivery: "C".repeat(800), itemsJson: "invalid json" }, { currentCheckpoint: "D\n\t".repeat(1000), customerNote: "E".repeat(1000), deliveryEstimate: "F".repeat(1000) }, "routine");
  for (const parameter of parameters) { assert.ok(parameter.length); assert.doesNotMatch(parameter, /[\n\r\t]/); }
  assert.ok(whatsappPreview(parameters).length <= 1024);
  assert.doesNotMatch(parameters[2], /Reply STOP/);
});

test("settings default to the exact tested template, English code and supported API version", () => {
  assert.deepEqual(whatsappSettings({}), { enabled: false, token: "", phoneId: "", template: "renova_delivery_update", language: "en", version: "v25.0" });
  assert.equal(whatsappSettings({ WHATSAPP_AUTOMATION_ENABLED: "false" }).enabled, false);
});

test("one atomic claim prevents two concurrent senders from making duplicate POSTs", async () => {
  const store = memoryStore(); let posts = 0;
  const fetcher = async (url, init) => { posts++; assert.match(url, /v25\.0\/123456\/messages$/); const body = JSON.parse(init.body); assert.equal(body.template.language.code, "en"); assert.equal(body.template.components[0].parameters.length, 4); return Response.json({ messages: [{ id: "wamid.unit-test" }] }); };
  await Promise.all([deliverQueuedWhatsApp(store, 1, settings, fetcher), deliverQueuedWhatsApp(store, 1, settings, fetcher)]);
  assert.equal(posts, 1); assert.equal(store.row.status, "accepted");
});

test("paused, ineligible and deferred jobs never reach the provider", async () => {
  const fetcher = async () => { throw new Error("Provider must not be called"); };
  const paused = memoryStore(); await deliverQueuedWhatsApp(paused, 1, { ...settings, enabled: false }, fetcher); assert.equal(paused.row.status, "pending"); assert.equal(paused.row.attempts, 0);
  const stopped = memoryStore({ eligible: false }); await deliverQueuedWhatsApp(stopped, 1, settings, fetcher); assert.equal(stopped.row.status, "cancelled");
  const deferred = memoryStore({ deferUntil: "2099-01-01T00:00:00.000Z" }); await deliverQueuedWhatsApp(deferred, 1, settings, fetcher); assert.equal(deferred.row.nextAttemptAt, "2099-01-01T00:00:00.000Z");
});

test("rate limits retry later; explicit rejection fails; ambiguous results are never retried automatically", async () => {
  const limited = memoryStore(); await deliverQueuedWhatsApp(limited, 1, settings, async () => Response.json({ error: { code: 130429 } }, { status: 429 })); assert.equal(limited.row.status, "pending"); assert.ok(Date.parse(limited.row.nextAttemptAt) > Date.now());
  const rejected = memoryStore(); await deliverQueuedWhatsApp(rejected, 1, settings, async () => Response.json({ error: { code: 190, message: settings.token } }, { status: 401 })); assert.equal(rejected.row.status, "failed"); assert.ok(!rejected.row.errorMessage.includes(settings.token));
  for (const fetcher of [async () => { throw new Error("timeout"); }, async () => Response.json({}), async () => Response.json({ error: { code: 2 } }, { status: 500 })]) {
    const store = memoryStore(); await deliverQueuedWhatsApp(store, 1, settings, fetcher); assert.equal(store.row.status, "uncertain");
    await deliverQueuedWhatsApp(store, 1, settings, async () => { assert.fail("No automatic retry after an uncertain send"); });
  }
});

test("STOP detection is deliberate and does not mistake an order cancellation discussion for opt-out", () => {
  for (const text of ["STOP", " stop ", "unsubscribe", "Stop updates."]) assert.equal(isWhatsAppStop(text), true);
  for (const text of ["don't stop", "please do not cancel my order", "hello", ""]) assert.equal(isWhatsAppStop(text), false);
});

test("webhook HMAC authenticates the exact raw body and rejects tampering or missing secrets", async () => {
  const bytes = new TextEncoder().encode('{"message":"STOP"}'), secret = "fake-signing-secret";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = `sha256=${Buffer.from(await crypto.subtle.sign("HMAC", key, bytes)).toString("hex")}`;
  assert.equal(await verifyWhatsAppSignature(bytes, signature, secret), true);
  assert.equal(await verifyWhatsAppSignature(new TextEncoder().encode('{ "message":"STOP"}'), signature, secret), false);
  assert.equal(await verifyWhatsAppSignature(bytes, signature, ""), false);
  assert.equal(await verifyWhatsAppSignature(bytes, "sha256=bad", secret), false);
});

test("oversized webhooks are rejected even without a content-length header", async () => {
  const request = new Request("https://renova.test/webhook", { method: "POST", body: "x".repeat(100) });
  await assert.rejects(limitedWebhookBody(request, 10), /too-large/);
});

test("the scheduler Worker rejects unauthenticated requests and makes one authenticated cron check", async () => {
  const { default: worker } = await import(pathToFileURL(join(process.env.RENOVA_TEST_SOURCE, "deployment/renova-reminder-cron-worker.js")));
  const env = { REMINDER_CRON_SECRET: "fake-worker-secret", RENOVA_APP_URL: "https://renova.example.invalid" };
  assert.equal((await worker.fetch(new Request("https://worker.test/"), env)).status, 405);
  assert.equal((await worker.fetch(new Request("https://worker.test/", { method: "POST" }), env)).status, 401);
  const original = globalThis.fetch; let checks = 0, scheduled;
  try {
    globalThis.fetch = async (url, init) => { checks++; assert.equal(String(url), "https://renova.example.invalid/api/orders/reminders/run"); assert.equal(init.headers.authorization, "Bearer fake-worker-secret"); return Response.json({ checked: 0 }); };
    await worker.scheduled({}, env, { waitUntil(task) { scheduled = task; } }); await scheduled; assert.equal(checks, 1);
  } finally { globalThis.fetch = original; }
});


test("daily messages retain item quantities and the amount while confirmed orders avoid transit claims", () => {
  for (const status of ["confirmed", "processing", "packaged", "dispatched"]) {
    const parameters = whatsappTemplateParameters({ ...order, status }, reminder, "routine");
    assert.match(parameters[2], /Your order/);
    assert.doesNotMatch(parameters[2], /{{|Your daily delivery update:/);
    assert.match(parameters[2], /2 × Wireless headphones/); assert.match(parameters[2], /₦24,500/);
    if (status !== "dispatched") assert.doesNotMatch(parameters[2], /on the way|has been dispatched/);
  }
  const confirmation = whatsappTemplateParameters(order, reminder, "confirmation")[2];
  assert.match(confirmation, /Thank you for choosing Renova/); assert.match(confirmation, /received and is being processed/);
});
