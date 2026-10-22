import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const load = (name) => import(pathToFileURL(join(process.env.RENOVA_TEST_BUILD, `${name}.mjs`)));
const { deliveryRegion, deliveryEstimateForAddress, standardDeliveryEstimate, normalizeDeliveryCopy, normalizeStructuredDeliveryCopy, DEFAULT_DELIVERY_ESTIMATE } = await load("app/lib/delivery-estimate");
const { deliveryOptions, deliveryOptionDetail, getDeliveryOption } = await load("app/lib/checkout");
const { normalizeFlexibleProductPage } = await load("app/lib/catalog");
const { whatsappTemplateParameters } = await load("app/lib/whatsapp-message");
const chat = await load("app/api/chat/route");

test("Lagos state codes, names and legacy address objects select the Lagos estimate", () => {
  for (const address of [{ stateCode: "LA" }, { state: "Lagos" }, { stateName: "Lagos State" }, { state_code: "NG-LA" }, { state: { name: "Lagos" } }, { state: { code: "la" } }, JSON.stringify({ stateCode: "LA" })]) {
    assert.equal(deliveryRegion(address), "lagos");
    assert.equal(deliveryEstimateForAddress(address), "3–5 working days");
  }
});

test("other Nigerian states use 3–12 days without mistaking a Lagos road or city for the state", () => {
  for (const state of ["OG", "Ogun", "FC", "Abuja", "Federal Capital Territory", "Rivers State", "NG-AB"]) {
    assert.equal(deliveryEstimateForAddress({ state, cityTown: "Lagos", streetAddress: "Lagos Ibadan Road" }), "3–12 working days");
  }
  assert.equal(deliveryRegion({ stateCode: "OG", stateName: "Lagos" }), "outside_lagos");
});

test("unknown or malformed addresses show both regions rather than promising the Lagos window", () => {
  for (const address of [undefined, null, "bad json", "{}", [], {}, { stateCode: "??", cityTown: "Lagos" }]) {
    assert.equal(deliveryEstimateForAddress(address), DEFAULT_DELIVERY_ESTIMATE);
  }
  assert.ok(DEFAULT_DELIVERY_ESTIMATE.length < 110);
});

test("old generic order estimates follow the state while calendar dates and specific courier estimates survive", () => {
  for (const value of [undefined, "", "3-5 working days", "3 – 7 working days.", "3 to 7 business days", "3–12 working days", DEFAULT_DELIVERY_ESTIMATE]) {
    assert.equal(standardDeliveryEstimate(value, { stateCode: "LA" }), "3–5 working days");
    assert.equal(standardDeliveryEstimate(value, { stateCode: "OG" }), "3–12 working days");
  }
  for (const value of ["24–26 October", "30 October 2026", "7–10 working days, confirmed by courier"]) assert.equal(standardDeliveryEstimate(value, { stateCode: "LA" }), value);
});

test("checkout carrier detail changes with the selected state and retains carrier identity and fees", () => {
  for (const option of deliveryOptions.filter((item) => item.id !== "kwik")) {
    assert.match(deliveryOptionDetail(option, { stateCode: "LA" }), /^3–5 working days · /);
    assert.match(deliveryOptionDetail(option, { stateCode: "OG" }), /^3–12 working days · /);
    assert.equal(getDeliveryOption(option.id, { stateCode: "OG" }).priceKobo, option.priceKobo);
    assert.equal(getDeliveryOption(option.id, { stateCode: "OG" }).name, option.name);
  }
  assert.match(deliveryOptionDetail(getDeliveryOption("kwik"), { stateCode: "LA" }), /3–5 working days · Lagos routes only/);
});

test("saved FAQ and landing-page delivery copy refreshes on read without changing refunds, warranties or dates", () => {
  const saved = { faq: { items: [
    { question: "When will it arrive?", answer: "Usually within 3–5 working days." },
    { question: "How long does return delivery take?", answer: "3–5 working days." },
    { question: "When is my refund?", answer: "3–5 working days." },
  ] }, trust: { items: [{ title: "3–7 working days", text: "Estimated delivery" }] }, hero: { subtitle: "Delivery in 3–5 working days. Refunds take 3–5 working days." } };
  const copy = normalizeFlexibleProductPage({}, saved);
  assert.ok(copy.faq.items[0].answer.includes(DEFAULT_DELIVERY_ESTIMATE));
  assert.equal(copy.faq.items[1].answer, saved.faq.items[1].answer);
  assert.equal(copy.faq.items[2].answer, saved.faq.items[2].answer);
  assert.equal(copy.trust.items[0].title, DEFAULT_DELIVERY_ESTIMATE);
  assert.equal(copy.hero.subtitle, `Delivery in ${DEFAULT_DELIVERY_ESTIMATE}. Refunds take 3–5 working days.`);
  assert.deepEqual(normalizeStructuredDeliveryCopy(copy), copy);
  assert.equal(saved.faq.items[0].answer, "Usually within 3–5 working days.");
  for (const text of ["Warranty: 3–5 working days", "Battery lasts 3–5 days", "Refunds take 3–5 working days after delivery", "Delivery on 24–26 October"]) assert.equal(normalizeDeliveryCopy(text), text);
});

test("all WhatsApp message kinds use the destination window with the existing four template variables", () => {
  const order = { customerName: "Amina Example", orderNumber: "REN-QA-001", status: "processing", paymentMethod: "cash_on_delivery", paymentStatus: "payment_due_on_delivery", totalKobo: 2450000, itemsJson: '[{"name":"Headphones","quantity":1}]', estimatedDelivery: "3–7 working days" };
  const reminder = { currentCheckpoint: "", customerNote: "", deliveryEstimate: "3–5 working days" };
  for (const kind of ["confirmation", "routine", "activation", "arrival"]) {
    assert.equal(whatsappTemplateParameters({ ...order, addressJson: '{"stateCode":"LA"}' }, reminder, kind)[3], "3–5 working days");
    assert.equal(whatsappTemplateParameters({ ...order, addressJson: '{"stateCode":"OG"}' }, reminder, kind)[3], "3–12 working days");
    assert.equal(whatsappTemplateParameters(order, reminder, kind).length, 4);
  }
  assert.equal(whatsappTemplateParameters({ ...order, addressJson: '{"stateCode":"OG"}' }, { ...reminder, deliveryEstimate: "24–26 October" }, "routine")[3], "24–26 October");
});

test("shopping assistant returns the regional policy for delivery questions without an external AI request", async () => {
  const previous = globalThis.fetch;
  const previousProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "local";
  const productsKey = Symbol.for("renova-whatsapp-test-products");
  const previousProducts = globalThis[productsKey];
  globalThis.fetch = async () => { throw new Error("Delivery policy should not require external services"); };
  try {
    for (const message of ["How long is delivery?", "When will it arrive?", "Shipping outside Lagos?"]) {
      const response = await chat.POST(new Request("https://renova.example.invalid/api/chat", { method: "POST", body: JSON.stringify({ message }) }));
      assert.equal(response.status, 200);
      assert.ok((await response.json()).reply.includes(DEFAULT_DELIVERY_ESTIMATE));
    }
    globalThis[productsKey] = [{ slug: "qa", name: "QA product", categorySlug: "electronics", priceKobo: 10000, stock: 1, description: "QA", variants: [], chatbotFaq: [{ question: "Can I pay cash on delivery?", answer: "Payment options depend on the product." }] }];
    const response = await chat.POST(new Request("https://renova.example.invalid/api/chat", { method: "POST", body: JSON.stringify({ slug: "qa", message: "Can I pay cash on delivery?" }) }));
    assert.equal((await response.json()).reply, "Payment options depend on the product.");
  } finally {
    globalThis.fetch = previous;
    globalThis[productsKey] = previousProducts;
    if (previousProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = previousProvider;
  }
});
