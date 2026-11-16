import assert from "node:assert/strict";
import { test, before, beforeEach, after } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = process.env.RENOVA_TEST_SOURCE, build = process.env.RENOVA_TEST_BUILD;
const load = (file) => import(pathToFileURL(join(build, file.replace(/\.tsx?$/, ".mjs"))));
const schema = await load("db/schema.ts");
const route = await load("app/api/anagen/order/route.ts");
const track = await load("app/api/orders/track/route.ts");
const wa = await load("app/lib/whatsapp-notifications.ts");
const reminders = await load("app/lib/customer-reminders.ts");
const cod = await load("app/api/checkout/place-order/route.ts");
const prepaid = await load("app/api/checkout/initialize/route.ts");
const { AnagenOrderForm } = await load("app/components/anagen-order-form.tsx");
const { ANAGEN, anagenProductValues } = await import(pathToFileURL(join(root, "app/lib/anagen-offer.mjs")));
const { applyAnagenProductSetup, validateAnagenDatabaseUrl } = await import(pathToFileURL(join(root, "scripts/anagen-product-setup.mjs")));
const pg = new PGlite();
const db = drizzle(pg, { schema });
const originalFetch = globalThis.fetch;
let calls, failOwner;
const facade = {
  query: (text, params = []) => pg.query(text, params),
  transaction: async (statements) => {
    await pg.exec("BEGIN");
    try {
      const result = [];
      for (const item of statements) result.push(await pg.query(item.text, item.params));
      await pg.exec("COMMIT"); return result;
    } catch (error) { await pg.exec("ROLLBACK"); throw error; }
  },
};

before(async () => {
  const journal = JSON.parse(await readFile(join(root, "drizzle-neon/meta/_journal.json"), "utf8"));
  for (const entry of journal.entries) await pg.exec(await readFile(join(root, `drizzle-neon/${entry.tag}.sql`), "utf8"));
});
beforeEach(async () => {
  await pg.exec("TRUNCATE reminder_message_settings,whatsapp_messages,whatsapp_receipts,order_reminder_logs,order_reminders,orders,products,categories RESTART IDENTITY");
  globalThis[Symbol.for("renova-whatsapp-test-db")] = db;
  await db.insert(schema.products).values({ name: "Existing Renova product", slug: "existing-product", sku: "REN-EXISTING", categorySlug: "health-beauty", priceKobo: 700000, imageUrl: "/existing.jpg", stock: 25, isPublished: true, isTestData: false });
  await db.insert(schema.orders).values({ orderNumber: "REN-EXISTING-ORDER", customerName: "Existing customer", customerEmail: "existing@example.invalid", customerPhone: "2348000000000", totalKobo: 700000, itemsJson: "[]", addressJson: "{}", shippingJson: "{}" });
  await applyAnagenProductSetup(facade, 50);
  calls = []; failOwner = false;
  Object.assign(process.env, { WHATSAPP_AUTOMATION_ENABLED: "true", WHATSAPP_ACCESS_TOKEN: "fake-anagen-token", WHATSAPP_PHONE_NUMBER_ID: "123456", WHATSAPP_REMINDER_TEMPLATE: "renova_delivery_update", WHATSAPP_TEMPLATE_LANGUAGE: "en", WHATSAPP_GRAPH_API_VERSION: "v25.0", FORMSPREE_ENDPOINT: "https://forms.example.invalid/anagen", RESEND_API_KEY: "fake-resend", RESEND_FROM_EMAIL: "qa@example.invalid", APP_URL: "https://renova.example.invalid", PAYSTACK_SECRET_KEY: "fake-paystack", TERMII_API_KEY: "" });
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url: String(url), body, headers: init.headers });
    if (String(url).startsWith("https://graph.facebook.com/")) return Response.json({ messages: [{ id: `wamid.anagen-${calls.length}` }] });
    if (String(url) === "https://forms.example.invalid/anagen") return Response.json({ ok: !failOwner }, { status: failOwner ? 503 : 200 });
    if (String(url) === "https://api.resend.com/emails") return failOwner && body.to?.includes("airebirth5@gmail.com") ? Response.json({ error: "Fixture owner provider is unavailable" }, { status: 503 }) : Response.json({ id: "qa-email" });
    throw new Error(`Unexpected outbound request blocked: ${String(url)}`);
  };
});
after(async () => { globalThis.fetch = originalFetch; delete globalThis[Symbol.for("renova-whatsapp-test-db")]; await pg.close(); });

function payload(overrides = {}) {
  return { offerVersion: ANAGEN.version, idempotencyKey: crypto.randomUUID(), quantity: 1, customerConfirmedDeliveryCommitment: true, whatsappNoticeVersion: "checkout-v3", website: "", details: { fullName: "Amina Example", phone: "08000000000", whatsappPhone: "08000000001", alternativePhone: "08000000002", email: "", streetAddress: "12 Example Street", cityTown: "Ikeja", stateCode: "LA", lga: "Ikeja", availabilityDay: "Tomorrow" }, ...overrides };
}
const request = (value, headers = {}) => new Request("https://renova.example.invalid/api/anagen/order", { method: "POST", headers: { "content-type": "application/json", origin: "https://renova.example.invalid", ...headers }, body: typeof value === "string" ? value : JSON.stringify(value) });
const anagenOrders = () => db.select().from(schema.orders).where(eq(schema.orders.paymentMethod, "cash_on_delivery"));
const graph = () => calls.filter((call) => call.url.startsWith("https://graph.facebook.com/"));
const owner = () => calls.filter((call) => call.url === "https://api.resend.com/emails" && call.body.to?.includes("airebirth5@gmail.com"));

test("Anagen checkout computes all three exact bundle totals and records free delivery in Renova", async () => {
  for (const bundle of ANAGEN.bundles) {
    const result = await route.POST(request(payload({ quantity: bundle.packs, totalKobo: 1, price: 1, deliveryPrice: 99999999, slug: "existing-product" })));
    assert.equal(result.status, 201);
    const body = await result.json(); assert.equal(body.totalKobo, bundle.totalKobo);
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.orderNumber, body.orderNumber));
    assert.equal(order.totalKobo, bundle.totalKobo); assert.equal(order.paymentStatus, "payment_due_on_delivery");
    assert.equal(JSON.parse(order.shippingJson).priceKobo, 0); assert.equal(order.estimatedDelivery, "1–2 working days");
    const [line] = JSON.parse(order.itemsJson); assert.equal(line.packQuantity, bundle.packs); assert.equal(line.quantity * line.unitPriceKobo, bundle.totalKobo); assert.equal(line.slug, "anagen");
    assert.match(line.name, new RegExp(bundle.label));
  }
  assert.equal(owner().length, 3); assert.equal(graph().length, 3);
});

test("Anagen optional email still sends owner email and one confirmation to the separate WhatsApp number", async () => {
  const result = await route.POST(request(payload())); assert.equal(result.status, 201);
  const [order] = await anagenOrders(); assert.equal(order.customerEmail, ""); assert.equal(order.whatsappPhone, "2348000000001");
  assert.equal(owner().length, 1);
  const mail = owner()[0];
  assert.deepEqual(mail.body.to, ["airebirth5@gmail.com"]);
  for (const text of ["Not provided", "2348000000001", "2348000000002", "Tomorrow", "Anagen", "1 pack", "₦11,200"]) assert.ok(mail.body.text.includes(text), text);
  assert.equal(calls.filter((call) => call.url === "https://api.resend.com/emails").length, 1);
  assert.equal(calls.filter((call) => call.url.includes("forms.example")).length, 0);
  assert.equal(mail.headers["Idempotency-Key"], `renova-owner-order-${order.orderNumber}`);
  assert.equal(graph().length, 1); assert.equal(graph()[0].body.to, "2348000000001");
  assert.match(graph()[0].body.template.components[0].parameters[3].text, /1–2 working days/);
  const [reminder] = await db.select().from(schema.orderReminders); assert.equal(reminder.active, true); assert.equal(reminder.whatsappEnabled, true);
});

test("Anagen supplied email receives the normal Renova customer confirmation", async () => {
  const value = payload(); value.details.email = "AMINA@example.invalid";
  assert.equal((await route.POST(request(value))).status, 201);
  const emails = calls.filter((call) => call.url === "https://api.resend.com/emails" && call.body.to?.includes("amina@example.invalid"));
  assert.equal(owner().length, 1); assert.equal(emails.length, 1); assert.deepEqual(emails[0].body.to, ["amina@example.invalid"]);
  assert.match(emails[0].body.html, /1–2 working days/); assert.doesNotMatch(emails[0].body.html, /3–12 working days/);
});

test("Anagen repeated and concurrent submissions create one order and one set of notifications", async () => {
  const value = payload({ quantity: 3 });
  const results = await Promise.all([route.POST(request(value)), route.POST(request(value)), route.POST(request(value))]);
  assert.deepEqual(results.map((item) => item.status).sort(), [200, 200, 201]);
  const bodies = await Promise.all(results.map((item) => item.json())); assert.equal(new Set(bodies.map((item) => item.orderNumber)).size, 1);
  assert.equal((await anagenOrders()).length, 1); assert.equal(owner().length, 1); assert.equal(graph().length, 1);
  const again = await route.POST(request(value)); assert.equal(again.status, 200); assert.equal((await again.json()).alreadyReceived, true);
  const changed = { ...value, quantity: 2 }; const conflict = await route.POST(request(changed)); assert.equal(conflict.status, 409); assert.equal((await conflict.json()).code, "REFERENCE_USED");
  assert.equal(owner().length, 1); assert.equal((await anagenOrders()).length, 1);
});

test("Anagen validation rejects missing WhatsApp, unagreed orders, invalid quantities and malformed input before saving", async () => {
  const valid = payload();
  const invalid = [
    { ...valid, details: { ...valid.details, whatsappPhone: "" } },
    { ...valid, details: { ...valid.details, email: "not-an-email" } },
    { ...valid, details: { ...valid.details, stateCode: "XX" } },
    { ...valid, details: { ...valid.details, availabilityDay: "Yesterday" } },
    { ...valid, details: { ...valid.details, streetAddress: "" } },
    { ...valid, customerConfirmedDeliveryCommitment: false },
    { ...valid, quantity: 0 }, { ...valid, quantity: 4 }, { ...valid, quantity: 1.5 }, { ...valid, quantity: "3" },
    { ...valid, idempotencyKey: "123" }, { ...valid, whatsappNoticeVersion: "unchecked" },
    { ...valid, website: "spam.example" },
  ];
  for (const value of invalid) assert.ok([400, 409].includes((await route.POST(request(value))).status));
  assert.equal((await route.POST(request("{broken"))).status, 400);
  assert.equal((await route.POST(request(" ".repeat(16001)))).status, 413);
  assert.equal((await route.POST(request(valid, { origin: "https://unrelated.example.invalid" }))).status, 403);
  assert.equal((await anagenOrders()).length, 0); assert.equal(calls.length, 0);
});

test("Anagen unpublished, unavailable and mismatched catalogue offers do not create an order", async () => {
  for (const patch of [{ stock: 0 }, { stock: 2 }, { isPublished: false }, { priceKobo: 100 }, { paymentMode: "prepaid" }, { sku: "OTHER-SKU" }]) {
    await db.update(schema.products).set({ stock: 50, isPublished: true, priceKobo: 1120000, paymentMode: "cash_on_delivery", sku: ANAGEN.sku, ...patch }).where(eq(schema.products.slug, ANAGEN.slug));
    assert.equal((await route.POST(request(payload({ quantity: 3 })))).status, 409);
  }
  assert.equal((await anagenOrders()).length, 0); assert.equal(calls.length, 0);
});

test("Anagen order remains saved if owner email is unavailable, and retries cannot duplicate it", async () => {
  failOwner = true; const value = payload();
  const result = await route.POST(request(value)); assert.equal(result.status, 201);
  assert.equal((await anagenOrders()).length, 1); assert.equal(graph().length, 1);
  assert.equal((await route.POST(request(value))).status, 200); assert.equal((await anagenOrders()).length, 1);
});

test("Anagen daily updates retain its delivery estimate, obey 24 hours and honor customer STOP", async () => {
  await route.POST(request(payload())); const [order] = await anagenOrders();
  const [reminder] = await db.select().from(schema.orderReminders);
  await reminders.dispatchReminder(reminder.id); await wa.runWhatsAppQueue(); assert.equal(graph().length, 1);
  const yesterday = new Date(Date.now() - 25 * 3600000).toISOString();
  await db.update(schema.whatsappMessages).set({ acceptedAt: yesterday });
  await db.update(schema.orderReminders).set({ nextSendAt: yesterday });
  await reminders.runDueReminders(); assert.equal(graph().length, 2);
  assert.match(graph()[1].body.template.components[0].parameters[3].text, /1–2 working days/);
  await wa.optOutWhatsApp(order.whatsappPhone);
  await db.update(schema.orderReminders).set({ nextSendAt: yesterday });
  await reminders.runDueReminders(); assert.equal(graph().length, 2);
});

test("Anagen phone tracking requires both order number and matching delivery phone, only when email was omitted", async () => {
  const response = await route.POST(request(payload())); const { orderNumber } = await response.json();
  const lookup = (body) => track.POST(new Request("https://renova.example.invalid/api/orders/track", { method: "POST", body: JSON.stringify(body) }));
  assert.equal((await lookup({ orderNumber })).status, 400);
  assert.equal((await lookup({ orderNumber, phone: "08000000009" })).status, 404);
  assert.equal((await lookup({ orderNumber, phone: "08000000001" })).status, 404);
  const result = await lookup({ orderNumber, phone: "08000000000" }); assert.equal(result.status, 200);
  const body = await result.json(); assert.equal(body.order.estimatedDelivery, "1–2 working days");
  assert.equal(body.order.customerName, undefined); assert.equal(body.order.customerPhone, undefined);
  const [order] = await anagenOrders(); await db.update(schema.orders).set({ customerEmail: "amina@example.invalid" }).where(eq(schema.orders.id, order.id));
  assert.equal((await lookup({ orderNumber, phone: "08000000000" })).status, 404);
  assert.equal((await lookup({ orderNumber, email: "AMINA@example.invalid" })).status, 200);
  assert.equal((await lookup({ orderNumber: "REN-EXISTING-ORDER", phone: "08000000000" })).status, 404);
});

test("normal checkout cannot bypass Anagen's dedicated pricing and delivery rules", async () => {
  const body = { lines: [{ slug: "anagen", quantity: 3 }], details: { fullName: "Example" }, deliveryId: "jumia" };
  for (const handler of [cod, prepaid]) assert.equal((await handler.POST(new Request("https://renova.example.invalid/api/checkout/place-order", { method: "POST", body: JSON.stringify(body) }))).status, 400);
  assert.equal((await anagenOrders()).length, 0); assert.equal(calls.length, 0);
});

test("Anagen product setup preserves existing stock, owner edits, orders and all other products on rerun", async () => {
  const before = await db.select().from(schema.products).where(eq(schema.products.slug, "existing-product"));
  await db.update(schema.products).set({ stock: 12, description: "Owner edited description" }).where(eq(schema.products.slug, ANAGEN.slug));
  const result = await applyAnagenProductSetup(facade, 999);
  assert.equal(result.alreadyApplied, true); assert.equal(result.product.stock, 12);
  const [current] = await db.select().from(schema.products).where(eq(schema.products.slug, ANAGEN.slug)); assert.equal(current.description, "Owner edited description");
  assert.deepEqual(await db.select().from(schema.products).where(eq(schema.products.slug, "existing-product")), before);
  assert.equal((await db.select().from(schema.orders)).length, 1); assert.equal(calls.length, 0);
});

test("Anagen setup is additive, rolls back a failed insert, and rejects an unrelated database", async () => {
  await db.delete(schema.products).where(eq(schema.products.slug, ANAGEN.slug)); await db.delete(schema.categories);
  const failing = { ...facade, transaction: (statements) => facade.transaction([...statements, { text: "SELECT missing_anagen_column", params: [] }]) };
  await assert.rejects(applyAnagenProductSetup(failing, 5));
  assert.equal((await db.select().from(schema.products).where(eq(schema.products.slug, ANAGEN.slug))).length, 0);
  assert.equal((await db.select().from(schema.categories)).length, 0);
  await applyAnagenProductSetup(facade, 5); assert.equal((await db.select().from(schema.products).where(eq(schema.products.slug, ANAGEN.slug)))[0].stock, 5);
  assert.throws(() => anagenProductValues(-1), /pack count/);
  assert.throws(() => validateAnagenDatabaseUrl("postgresql://user:password@unrelated.example.invalid/db"), /restored Renova/);
  assert.equal(validateAnagenDatabaseUrl("postgresql://user:password@ep-sweet-cake-bah8seo5-pooler.c-8.eu-central-1.aws.neon.tech/neondb").protocol, "postgresql:");
  assert.equal(validateAnagenDatabaseUrl("postgresql://avnadmin:TEST_ONLY@pg-1c5cf951-renova.f.aivencloud.com:15591/renova_store_20261116t130637_fc06d9f3").pathname,"/renova_store_20261116t130637_fc06d9f3");
  assert.throws(() => validateAnagenDatabaseUrl("postgresql://avnadmin:TEST_ONLY@pg-1c5cf951-renova.f.aivencloud.com:15591/defaultdb"),/verified Aiven store/);
});

test("Anagen form renders a separate WhatsApp field, optional email and all Nigerian states without friend tracking", async () => {
  const html = renderToStaticMarkup(React.createElement(AnagenOrderForm, { stock: 50, supportPhone: "2348000000000" }));
  assert.match(html, /<input(?=[^>]*name="whatsappPhone")(?=[^>]*required)[^>]*>/); assert.match(html, /name="email"/);
  assert.doesNotMatch(html, /<input(?=[^>]*name="email")(?=[^>]*required)[^>]*>/); assert.doesNotMatch(html, /Reply STOP/);
  assert.match(html, /FCT — Abuja/); assert.match(html, /value="LA"/); assert.match(html, /value="ZA"/);
  assert.match(html, /₦11,200/); assert.match(html, /₦20,400/); assert.match(html, /₦28,600/);
  assert.match(html, /wa\.me\/2348000000000/); assert.doesNotMatch(html, /2347032161983|1023272507453983|process_order\.php/);
  const unavailable = renderToStaticMarkup(React.createElement(AnagenOrderForm, { stock: 0, supportPhone: "" }));
  assert.match(unavailable, /currently unavailable/); assert.match(unavailable, /fieldset disabled/);
});
