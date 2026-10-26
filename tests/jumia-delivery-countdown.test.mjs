import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const load = (name) => import(pathToFileURL(join(process.env.RENOVA_TEST_BUILD, `${name}.mjs`)));
const { jumiaDeliveryCountdown, nigeriaCalendarDate, validateJumiaDeliveryWindow } = await load("app/lib/jumia-delivery-countdown");
const { whatsappTemplateParameters, whatsappPreview, reminderMessageFields } = await load("app/lib/whatsapp-message");
const window = { jumiaDeliveryFrom: "2026-11-01", jumiaDeliveryTo: "2026-11-03" };
const at = (date) => new Date(`${date}T12:00:00+01:00`);
const order = { customerName: "Amina Example", orderNumber: "REN-COUNTDOWN-001", customerPhone: "08000000000", status: "dispatched", paymentMethod: "cash_on_delivery", paymentStatus: "payment_due_on_delivery", totalKobo: 2450000, itemsJson: '[{"name":"Headphones","quantity":1}]', addressJson: '{"stateCode":"LA"}', estimatedDelivery: "3–5 working days" };
const reminder = { currentCheckpoint: "", deliveryEstimate: "", customerNote: "", arrivalCheckpoint: "Pickup desk B", reminderPhase: "delivery", ...window };

test("Jumia ranges count calendar days down on each sending date across October and November", () => {
  for (const [date, fromDays, toDays] of [["2026-10-27", 5, 7], ["2026-10-28", 4, 6], ["2026-10-29", 3, 5], ["2026-10-31", 1, 3]]) {
    const result = jumiaDeliveryCountdown(window, at(date));
    assert.equal(result.fromDays, fromDays); assert.equal(result.toDays, toDays);
    assert.match(result.message, new RegExp(`${fromDays}–${toDays} days`));
    assert.equal(result.dateLabel, "1–3 November 2026");
  }
});

test("the start and middle of a delivery window use today-based wording without claiming arrival", () => {
  const start = jumiaDeliveryCountdown(window, at("2026-11-01"));
  assert.equal(start.state, "in_window"); assert.match(start.message, /today or within the next 2 days/);
  const middle = jumiaDeliveryCountdown(window, at("2026-11-02"));
  assert.match(middle.message, /today or tomorrow/);
  for (const result of [start, middle]) assert.doesNotMatch(result.message, /has arrived|is here|ready for collection/);
});

test("the last estimated day says expected today and waits for verified arrival", () => {
  const result = jumiaDeliveryCountdown(window, at("2026-11-03"));
  assert.equal(result.state, "today"); assert.match(result.message, /expected today/); assert.match(result.message, /arrival is confirmed/);
  assert.doesNotMatch(result.message, /has arrived|is here|ready for collection/);
});

test("overdue windows never show negative days, reset the countdown or turn into arrival claims", () => {
  const result = jumiaDeliveryCountdown(window, at("2026-11-06"));
  assert.equal(result.state, "overdue"); assert.match(result.message, /window has passed/);
  assert.doesNotMatch(result.message, /-\d|in \d+ days|has arrived|ready for collection/);
});

test("a single expected date supports tomorrow, today and overdue states", () => {
  const single = { jumiaDeliveryFrom: "2026-11-01" };
  assert.match(jumiaDeliveryCountdown(single, at("2026-10-31")).message, /expected tomorrow/);
  assert.match(jumiaDeliveryCountdown(single, at("2026-11-01")).message, /expected today/);
  assert.equal(jumiaDeliveryCountdown(single, at("2026-11-02")).state, "overdue");
  assert.equal(jumiaDeliveryCountdown(single, at("2026-10-27")).dateLabel, "1 November 2026");
});

test("Nigeria midnight controls the day independently of the server's UTC date", () => {
  const before = new Date("2026-10-26T22:59:59Z");
  const after = new Date("2026-10-26T23:00:00Z");
  assert.equal(nigeriaCalendarDate(before), "2026-10-26"); assert.equal(nigeriaCalendarDate(after), "2026-10-27");
  assert.equal(jumiaDeliveryCountdown(window, before).fromDays, 6);
  assert.equal(jumiaDeliveryCountdown(window, after).fromDays, 5);
});

test("leap days and year boundaries use whole calendar dates", () => {
  const leap = jumiaDeliveryCountdown({ jumiaDeliveryFrom: "2028-02-29", jumiaDeliveryTo: "2028-03-01" }, at("2028-02-27"));
  assert.equal(leap.fromDays, 2); assert.equal(leap.toDays, 3);
  const year = jumiaDeliveryCountdown({ jumiaDeliveryFrom: "2026-12-31", jumiaDeliveryTo: "2027-01-02" }, at("2026-12-30"));
  assert.equal(year.fromDays, 1); assert.equal(year.toDays, 3); assert.equal(year.dateLabel, "31 December 2026 – 2 January 2027");
});

test("date validation rejects impossible, reversed, incomplete and ambiguous dates and accepts explicit clearing", () => {
  for (const value of [{ from: "2026-02-29" }, { from: "2026-11-31" }, { from: "01/11/2026" }, { from: "2026-11-01T12:00:00Z" }, { from: "2026-11-03", to: "2026-11-01" }, { from: "", to: "2026-11-03" }, { from: true }, [], { from: "2026-11-01", ignored: "2026-11-03" }]) assert.throws(() => validateJumiaDeliveryWindow(value));
  assert.deepEqual(validateJumiaDeliveryWindow({ from: "2026-11-01", to: "" }), { from: "2026-11-01", to: "2026-11-01" });
  assert.deepEqual(validateJumiaDeliveryWindow({ from: "", to: "" }), { from: null, to: null });
  assert.deepEqual(validateJumiaDeliveryWindow(null), { from: null, to: null });
  assert.equal(jumiaDeliveryCountdown({ jumiaDeliveryFrom: "bad" }, at("2026-10-27")), null);
});

test("the Jumia countdown and payment preparation are automatic even when custom wording omits the variable", () => {
  const custom = { ...reminder, messageOverridesJson: '{"routine":{"message":"Thank you for your patience.","deliveryEstimate":"An older free-text estimate"}}' };
  const parameters = whatsappTemplateParameters(order, custom, "routine", undefined, at("2026-10-27"));
  assert.match(parameters[2], /^Your order is expected in 5–7 days\. Please keep your payment ready/);
  assert.match(parameters[2], /Thank you for your patience/); assert.match(parameters[2], /₦24,500/); assert.match(parameters[2], /Reply STOP/);
  assert.equal(parameters[3], "1–3 November 2026"); assert.doesNotMatch(whatsappPreview(parameters), /older free-text/);
});

test("custom countdown variables do not duplicate the automatic countdown and long wording stays bounded", () => {
  const custom = { ...reminder, messageOverridesJson: JSON.stringify({ routine: { message: "{{delivery_countdown}} {{customer_name}} {{courier_update}} {{jumia_delivery_window}}", note: "N".repeat(80) } }), currentCheckpoint: "C".repeat(500) };
  const parameters = whatsappTemplateParameters({ ...order, customerName: "A".repeat(200), orderNumber: "B".repeat(200) }, custom, "routine", undefined, at("2026-10-27"));
  assert.equal(parameters[2].split("Your order is expected in 5–7 days.").length - 1, 1);
  assert.ok(whatsappPreview(parameters).length <= 1024); assert.match(parameters[2], /Reply STOP to stop WhatsApp updates\.$/);
});

test("prepaid reminders do not ask for payment to be kept ready", () => {
  const parameters = whatsappTemplateParameters({ ...order, paymentMethod: "paystack", paymentStatus: "paid" }, reminder, "routine", undefined, at("2026-10-27"));
  assert.match(parameters[2], /expected in 5–7 days/); assert.match(parameters[2], /Payment of ₦24,500 has been received/);
  assert.doesNotMatch(parameters[2], /keep your payment ready|due when you receive/);
});

test("Jumia dates do not change the initial confirmation or the separately verified arrival reminder", () => {
  const initial = whatsappTemplateParameters(order, { currentCheckpoint: "", deliveryEstimate: "", customerNote: "" }, "confirmation", undefined, at("2026-10-27"));
  assert.deepEqual(whatsappTemplateParameters(order, reminder, "confirmation", undefined, at("2026-10-27")), initial);
  assert.equal(initial[3], "3–5 working days"); assert.doesNotMatch(whatsappPreview(initial), /November|5–7 days/);
  const arrived = whatsappTemplateParameters(order, { ...reminder, reminderPhase: "arrival", arrivalConfirmedAt: "2026-10-30T12:00:00Z" }, "arrival_reminder", undefined, at("2026-10-30"));
  assert.match(arrived[2], /has arrived and is ready for collection/); assert.doesNotMatch(arrived[2], /expected in|payment ready/); assert.equal(arrived[3], "Ready for collection now");
});

test("missing or cleared Jumia dates use the original reminder estimate without a fabricated countdown", () => {
  const fields = reminderMessageFields(order, { ...reminder, jumiaDeliveryFrom: null, jumiaDeliveryTo: null }, "routine", undefined, at("2026-10-27"));
  assert.equal(fields.countdown, null); assert.equal(fields.estimate, "3–5 working days"); assert.doesNotMatch(fields.message, /expected in \d|keep your payment ready/);
});
