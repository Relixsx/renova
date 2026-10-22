import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const { CART_STORAGE_KEY, readStoredCart, writeStoredCart, rememberCheckoutCart, completeCheckoutCart, createCartStore } = await import(pathToFileURL(join(process.env.RENOVA_TEST_BUILD, "app/lib/cart-storage.mjs")));
const { checkoutWhatsAppConsent } = await import(pathToFileURL(join(process.env.RENOVA_TEST_BUILD, "app/lib/checkout-whatsapp.mjs")));
const line = { slug: "headphones", name: "Headphones", imageUrl: "/qa.svg", priceKobo: 2450000, variant: "Black", quantity: 2, paymentMode: "cash_on_delivery" };
function storage() {
  const entries = new Map();
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) };
}

test("successful COD clearing is persisted before navigation, with zero lines, count and subtotal on reload", () => {
  const saved = storage(); writeStoredCart(saved, [line]);
  writeStoredCart(saved, []);
  assert.equal(saved.getItem(CART_STORAGE_KEY), "[]");
  const reloaded = readStoredCart(saved);
  assert.deepEqual(reloaded, []);
  assert.equal(reloaded.reduce((sum, item) => sum + item.quantity, 0), 0);
  assert.equal(reloaded.reduce((sum, item) => sum + item.quantity * item.priceKobo, 0), 0);
});

test("initializing or abandoning a prepaid checkout retains the bag until verified completion", () => {
  const saved = storage(); writeStoredCart(saved, [line]);
  rememberCheckoutCart(saved, "REN-PAID-001", [line]);
  assert.deepEqual(readStoredCart(saved), [line]);
  assert.equal(completeCheckoutCart(saved, "different-order"), false);
  assert.deepEqual(readStoredCart(saved), [line]);
  assert.equal(completeCheckoutCart(saved, "REN-PAID-001"), true);
  assert.deepEqual(readStoredCart(saved), []);
});

test("reloading an old success URL cannot clear a new cart, even with identical items", () => {
  const saved = storage(); writeStoredCart(saved, [line]);
  rememberCheckoutCart(saved, "REN-PAID-001", [line]);
  completeCheckoutCart(saved, "REN-PAID-001");
  writeStoredCart(saved, [line]);
  assert.equal(completeCheckoutCart(saved, "REN-PAID-001"), false);
  assert.deepEqual(readStoredCart(saved), [line]);
});

test("an intervening cart edit or another tab preserves the newer selection on payment return", () => {
  const saved = storage(); writeStoredCart(saved, [line]);
  rememberCheckoutCart(saved, "REN-PAID-001", [line]);
  writeStoredCart(saved, [{ ...line, quantity: 3 }]);
  assert.equal(completeCheckoutCart(saved, "REN-PAID-001"), false);
  assert.equal(readStoredCart(saved)[0].quantity, 3);
  // Editing back to the same contents still represents a newer cart revision.
  rememberCheckoutCart(saved, "REN-PAID-002", readStoredCart(saved));
  writeStoredCart(saved, [line]); writeStoredCart(saved, [{ ...line, quantity: 3 }]);
  assert.equal(completeCheckoutCart(saved, "REN-PAID-002"), false);
  assert.equal(readStoredCart(saved)[0].quantity, 3);
});

test("stale initialization cannot register a different or newer bag for clearing", () => {
  const saved = storage(); writeStoredCart(saved, [{ ...line, quantity: 3 }]);
  rememberCheckoutCart(saved, "REN-PAID-001", [line]);
  assert.equal(completeCheckoutCart(saved, "REN-PAID-001"), false);
  assert.equal(readStoredCart(saved)[0].quantity, 3);
});

test("malformed or unavailable storage does not throw or manufacture a completed checkout", () => {
  const saved = storage(); saved.setItem(CART_STORAGE_KEY, "invalid");
  assert.deepEqual(readStoredCart(saved), []);
  saved.setItem(CART_STORAGE_KEY, '{"not":"an array"}'); assert.deepEqual(readStoredCart(saved), []);
  const unavailable = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.deepEqual(readStoredCart(unavailable), []);
  assert.doesNotThrow(() => writeStoredCart(unavailable, []));
  assert.doesNotThrow(() => rememberCheckoutCart(unavailable, "REN-QA", [line]));
  assert.equal(completeCheckoutCart(unavailable, "REN-QA"), false);
});

test("new consent records the dedicated WhatsApp number and requires the displayed notice version", () => {
  const consent = checkoutWhatsAppConsent(false, "08000000000", { phone: "09000000001", noticeVersion: "checkout-v2" });
  assert.equal(consent.whatsappPhone, "2349000000001"); assert.equal(consent.whatsappConsentSource, "checkout-v2");
  assert.ok(Number.isFinite(Date.parse(consent.whatsappConsentAt)));
  for (const request of [null, {}, { phone: "", noticeVersion: "checkout-v2" }, { phone: "09000000001", noticeVersion: "unknown" }]) assert.throws(() => checkoutWhatsAppConsent(true, "08000000000", request));
  assert.deepEqual(checkoutWhatsAppConsent(false, "08000000000"), {});
  assert.equal(checkoutWhatsAppConsent(true, "08000000000").whatsappConsentSource, "checkout-v1");
});


test("React cart snapshots hydrate from storage, notify after synchronous saving, and stay stable between reads", () => {
  const saved = storage(); writeStoredCart(saved, [line]);
  const store = createCartStore(() => saved);
  assert.deepEqual(store.getServerSnapshot(), []);
  const hydrated = store.getSnapshot(); assert.deepEqual(hydrated, [line]); assert.equal(store.getSnapshot(), hydrated);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications++; assert.equal(saved.getItem(CART_STORAGE_KEY), "[]"); });
  store.commit([]);
  assert.equal(notifications, 1); assert.deepEqual(store.getSnapshot(), []);
  unsubscribe();
  // Represents a storage event/pageshow after another tab changed the bag.
  writeStoredCart(saved, [{ ...line, quantity: 4 }]); store.refresh();
  assert.equal(store.getSnapshot()[0].quantity, 4);
});
