import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const load = (name) => import(pathToFileURL(join(process.env.RENOVA_TEST_BUILD, `${name}.mjs`)));
const { DEFAULT_REMINDER_MESSAGES, validateMessageDefaults, validateMessageOverrides, resolveReminderMessage } = await load("app/lib/reminder-message-content");
const { whatsappTemplateParameters, whatsappPreview } = await load("app/lib/whatsapp-message");
const { OrderReminderMessageEditor, StoreReminderMessageDefaults } = await load("app/components/reminder-message-editor");
const order = { customerName: "Amina Example", orderNumber: "REN-MESSAGE-001", customerPhone: "08000000000", status: "dispatched", paymentMethod: "cash_on_delivery", paymentStatus: "payment_due_on_delivery", totalKobo: 2450000, itemsJson: '[{"name":"Headphones","quantity":1}]', addressJson: '{"stateCode":"OG"}', estimatedDelivery: "3–12 working days" };
const reminder = { currentCheckpoint: "At the dispatch hub", deliveryEstimate: "30 October", customerNote: "Keep your phone available", arrivalCheckpoint: "Collect at the verified pickup desk", reminderPhase: "delivery", messageOverridesJson: "{}" };

test("daily and arrival fields resolve independently, retaining specific courier dates when only wording changes", () => {
  const custom = { ...reminder, messageOverridesJson: JSON.stringify({ routine: { message: "Daily custom wording" }, arrival: { message: "Arrival custom wording", deliveryEstimate: "Collect by Friday" } }) };
  assert.equal(resolveReminderMessage("routine", custom).message, "Daily custom wording");
  assert.equal(resolveReminderMessage("routine", custom).deliveryEstimate, "30 October");
  assert.equal(resolveReminderMessage("routine", custom).note, reminder.customerNote);
  assert.equal(resolveReminderMessage("arrival", custom).message, "Arrival custom wording");
  assert.equal(resolveReminderMessage("arrival", custom).deliveryEstimate, "Collect by Friday");
  const reset = resolveReminderMessage("routine", { ...custom, messageOverridesJson: '{"routine":null}' });
  assert.deepEqual(reset, DEFAULT_REMINDER_MESSAGES.routine);
});

test("reminder edits and store defaults cannot change the initial confirmation", () => {
  const original = whatsappTemplateParameters(order, reminder, "confirmation");
  const defaults = structuredClone(DEFAULT_REMINDER_MESSAGES);
  defaults.routine.message = "Edited daily wording"; defaults.arrival.message = "Edited arrival wording";
  assert.deepEqual(whatsappTemplateParameters(order, { ...reminder, messageOverridesJson: '{"routine":{"message":"Another edit","deliveryEstimate":"Tomorrow"}}' }, "confirmation", defaults), original);
  assert.doesNotMatch(whatsappPreview(original), /Edited|Another edit|Tomorrow|At the dispatch hub/);
});

test("message validation rejects unknown fields, malformed variables, control characters and overlong copy", () => {
  for (const invalid of [null, [], { confirmation: {} }, { routine: { recipient: "new person" } }, { arrival: { message: "{{unknown}}" } }, { routine: { message: "{{first_name}" } }, { routine: { note: "A".repeat(81) } }, { routine: { emailHeading: "" } }, { routine: { message: "hidden\u0000value" } }]) assert.throws(() => validateMessageOverrides(invalid));
  assert.throws(() => validateMessageDefaults({ routine: {} }));
  assert.deepEqual(validateMessageOverrides({ routine: { message: "Hello {{first_name}}", note: "" }, arrival: null }), { routine: { message: "Hello {{first_name}}", note: "" }, arrival: null });
});

test("custom WhatsApp text expands actual order details, stays within the template and keeps STOP and payment facts", () => {
  const defaults = structuredClone(DEFAULT_REMINDER_MESSAGES);
  defaults.routine.message = "Hello {{first_name}}. Order {{order_number}}. {{status_update}} {{courier_update}}";
  const parameters = whatsappTemplateParameters(order, reminder, "routine", defaults);
  assert.match(parameters[2], /Hello Amina\. Order REN-MESSAGE-001/);
  assert.match(parameters[2], /1 × Headphones/); assert.match(parameters[2], /₦24,500/);
  assert.match(parameters[2], /Reply STOP to stop WhatsApp updates\.$/);
  assert.equal(parameters[3], "30 October");
  const lagosOrder = { ...order, addressJson: '{"stateCode":"LA"}', estimatedDelivery: "3–5 working days" };
  assert.equal(whatsappTemplateParameters(lagosOrder, { ...reminder, messageOverridesJson: '{"routine":{"deliveryEstimate":"3–12 working days"}}' }, "routine")[3], "3–12 working days");
  assert.equal(whatsappTemplateParameters(lagosOrder, { ...reminder, messageOverridesJson: '{"routine":{"deliveryEstimate":""}}' }, "routine")[3], "3–5 working days");
  assert.equal(whatsappTemplateParameters(order, { ...reminder, messageOverridesJson: '{"arrival":{"deliveryEstimate":""}}' }, "arrival")[3], "Ready for collection now");
  const long = whatsappTemplateParameters({ ...order, customerName: "A".repeat(200), orderNumber: "B".repeat(200) }, { ...reminder, currentCheckpoint: "C".repeat(500), messageOverridesJson: JSON.stringify({ routine: { message: "{{customer_name}} {{order_number}} {{courier_update}} ".repeat(3), note: "N".repeat(80) } }) }, "routine", defaults);
  assert.ok(whatsappPreview(long).length <= 1024);
  for (const value of long) assert.doesNotMatch(value, /[\n\r\t]/);
});

test("order and store editors render accessible independent fields without sending requests", () => {
  const html = renderToStaticMarkup(createElement(OrderReminderMessageEditor, { order: { id: 1, ...order }, reminder: { id: 1, orderId: 1, active: false, consentConfirmed: true, emailEnabled: false, whatsappEnabled: false, smsEnabled: false, ...reminder }, defaults: DEFAULT_REMINDER_MESSAGES, onSaved() {} }));
  for (const label of ["Order confirmation", "Daily delivery update", "Arrival and collection reminder", "Daily message", "Expected delivery line", "Customer instructions", "Email subject", "Email heading", "Save message &amp; Jumia dates", "Preview all three messages"]) assert.ok(html.includes(label), label);
  assert.ok(html.includes("Jumia expected delivery dates")); assert.ok(html.includes("Expected from")); assert.ok(html.includes("Expected to (optional for one date)"));
  const arrivalHtml = renderToStaticMarkup(createElement(OrderReminderMessageEditor, { order: { id: 1, ...order }, reminder: { id: 1, orderId: 1, active: true, consentConfirmed: true, emailEnabled: false, whatsappEnabled: true, smsEnabled: false, ...reminder, reminderPhase: "arrival", arrivalConfirmedAt: "2026-10-23T10:00:00.000Z" }, defaults: DEFAULT_REMINDER_MESSAGES, onSaved() {} }));
  assert.ok(arrivalHtml.includes("Arrival reminder message")); assert.ok(arrivalHtml.includes("Arrival or collection line"));
  const globalHtml = renderToStaticMarkup(createElement(StoreReminderMessageDefaults, { defaults: DEFAULT_REMINDER_MESSAGES, onSaved() {} }));
  assert.ok(globalHtml.includes("Save default messages")); assert.ok(globalHtml.includes("approved Meta template"));
});
