import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const load = (name) => import(pathToFileURL(join(process.env.RENOVA_TEST_BUILD, `${name}.mjs`)));
const { DEFAULT_REMINDER_MESSAGES, validateMessageDefaults, validateMessageOverrides, resolveReminderMessage, mergeReminderMessageOverrides } = await load("app/lib/reminder-message-content");
const { whatsappTemplateParameters, whatsappPreview, reminderMessageFields } = await load("app/lib/whatsapp-message");
const { OrderReminderMessageEditor, StoreReminderMessageDefaults, OrderMessageWorkspace } = await load("app/components/reminder-message-editor");
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

function workspaceProps(step = "routine", extra = {}) {
  const clock = new Date("2026-10-28T08:30:00Z");
  const source = { ...reminder, jumiaDeliveryFrom: "2026-11-06", jumiaDeliveryTo: "2026-11-10" };
  const configs = { routine: resolveReminderMessage("routine", source), arrival: resolveReminderMessage("arrival", source) };
  const preview = {
    previewNigeriaDate: "2026-10-28",
    confirmationPreview: whatsappPreview(whatsappTemplateParameters({ ...order, status: "confirmed" }, source, "confirmation", undefined, clock)),
    preview: whatsappPreview(whatsappTemplateParameters(order, source, "routine", undefined, clock)),
    arrivalPreview: whatsappPreview(whatsappTemplateParameters(order, source, "arrival", undefined, clock)),
    emailPreviews: { routine: reminderMessageFields(order, source, "routine", undefined, clock), arrival: reminderMessageFields(order, source, "arrival", undefined, clock) },
    smsPreviews: { routine: "Daily SMS preview", arrival: "Arrival SMS preview" },
  };
  const noop = () => {};
  return { order: { id: 1, ...order }, reminder: { id: 1, orderId: 1, active: true, consentConfirmed: true, emailEnabled: false, whatsappEnabled: true, smsEnabled: false, ...source }, expanded: true, step, channel: "whatsapp", configs,
    dates: { from: "2026-11-06", to: "2026-11-10" }, clock, checkpoint: source.currentCheckpoint, arrivalCheckpoint: source.arrivalCheckpoint,
    arrivalConfirmed: false, dirty: { routine: false, arrival: false }, busy: false, feedback: "", preview,
    actions: { toggle: noop, step: noop, channel: noop, date: noop, clearDates: noop, field: noop, checkpoint: noop, arrivalCheckpoint: noop, arrivalConfirmed: noop, reset: noop, save: noop, activateArrival: noop, retryPreview: noop }, ...extra };
}

test("all three message tabs are visible and the daily wording is a filled editable field in the main panel", () => {
  const html = renderToStaticMarkup(createElement(OrderReminderMessageEditor, { order: { id: 1, ...order }, reminder: workspaceProps().reminder, defaults: DEFAULT_REMINDER_MESSAGES, onSaved() {} }));
  for (const label of ["Order confirmation", "Daily delivery update", "Arrival &amp; collection", "Your message to the customer", "Jumia delivery dates", "Expected from", "Expected to", "Save daily update", "Message preview"]) assert.ok(html.includes(label), label);
  assert.equal((html.match(/role="tab"/g) || []).length, 3);
  assert.match(html, /<textarea[^>]*id="order-1-messages-routine-message"[^>]*>Thank you for your patience/);
  assert.doesNotMatch(html, /Optional: customise|View the other messages|{{status_update}}|{{courier_update}}|Insert an order detail/);
  const globalHtml = renderToStaticMarkup(createElement(StoreReminderMessageDefaults, { defaults: DEFAULT_REMINDER_MESSAGES, onSaved() {} }));
  assert.ok(globalHtml.includes("Save default messages")); assert.ok(globalHtml.includes("approved Meta template"));
  assert.ok(globalHtml.includes("Hello Sample,")); assert.doesNotMatch(globalHtml, /{{status_update}}|{{courier_update}}/);
});

test("the daily workspace shows today's and tomorrow's automatic counts alongside the actual customer preview", () => {
  const html = renderToStaticMarkup(createElement(OrderMessageWorkspace, workspaceProps()));
  assert.match(html, /Today/); assert.match(html, /28 October 2026/); assert.match(html, /9–13 days/);
  assert.match(html, /Tomorrow/); assert.match(html, /29 October 2026/); assert.match(html, /8–12 days/);
  assert.match(html, /Hello Amina,/); assert.match(html, /REN-MESSAGE-001/); assert.match(html, /₦24,500/);
  assert.match(html, /name, order details and daily countdown are filled in automatically/);
  assert.doesNotMatch(html, /type="date"[^>]*disabled/);
});

test("order confirmation has its own read-only tab and retains the original regional estimate", () => {
  const html = renderToStaticMarkup(createElement(OrderMessageWorkspace, workspaceProps("confirmation")));
  assert.match(html, /id="order-1-messages-tab-confirmation"[^>]*aria-selected="true"/);
  assert.match(html, /automatically for new orders after confirmation or verified payment/i);
  assert.match(html, /Thank you for choosing Renova/); assert.match(html, /3–12 working days/);
  assert.doesNotMatch(html, /<textarea|type="date"|Save daily update|9–13 days|6–10 November/);
});

test("arrival has its own editable wording and collection details and still requires explicit verification", () => {
  const html = renderToStaticMarkup(createElement(OrderMessageWorkspace, workspaceProps("arrival")));
  assert.match(html, /Your arrival message to the customer/); assert.match(html, /Where is the parcel ready for collection/);
  assert.match(html, /Save arrival wording/); assert.match(html, /has arrived and is ready for collection/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Confirm arrival and start arrival reminders/);
  assert.doesNotMatch(html, /type="date"|9–13 days/);
});

test("draft message fields merge by kind without discarding independent saved wording", () => {
  const saved = { routine: { message: "Daily wording", note: "Daily note" }, arrival: { message: "Arrival wording" } };
  const snapshot = structuredClone(saved);
  const merged = mergeReminderMessageOverrides(saved, { routine: { note: "Changed daily note" }, arrival: { deliveryEstimate: "Collect Friday" } });
  assert.deepEqual(merged, { routine: { message: "Daily wording", note: "Changed daily note" }, arrival: { message: "Arrival wording", deliveryEstimate: "Collect Friday" } });
  assert.deepEqual(saved, snapshot);
  assert.deepEqual(mergeReminderMessageOverrides(saved, { routine: null }), { routine: null, arrival: saved.arrival });
});

test("the ready-made daily message uses the customer's actual details without any owner-composed text", () => {
  const untouched = { currentCheckpoint: "", customerNote: "", deliveryEstimate: "", jumiaDeliveryFrom: "2026-11-06", jumiaDeliveryTo: "2026-11-09" };
  const text = whatsappPreview(whatsappTemplateParameters(order, untouched, "routine", undefined, new Date("2026-10-27T11:00:00Z")));
  assert.match(text, /Hello Amina,/); assert.match(text, /REN-MESSAGE-001/);
  assert.match(text, /expected in 10–13 days/); assert.match(text, /6–9 November 2026/);
  assert.match(text, /1 × Headphones/); assert.match(text, /₦24,500/); assert.match(text, /keep your payment ready/);
  assert.match(text, /dispatched and is on the way/); assert.match(text, /Reply STOP/);
  assert.doesNotMatch(text, /{{|Your daily delivery update:|undefined/);
});

test("untouched saved defaults adopt the simpler ready-made body while real owner wording remains intact", () => {
  const legacy = "Your daily delivery update: {{status_update}} {{courier_update}}";
  const defaults = structuredClone(DEFAULT_REMINDER_MESSAGES); defaults.routine.message = legacy;
  const saved = { ...reminder, messageOverridesJson: JSON.stringify({ routine: { message: legacy } }) };
  const text = whatsappPreview(whatsappTemplateParameters(order, saved, "routine", defaults));
  assert.match(text, /Courier update: At the dispatch hub/); assert.doesNotMatch(text, /Your daily delivery update:/);
  const custom = { ...saved, messageOverridesJson: '{"routine":{"message":"Please call us if you need help with collection."}}' };
  assert.match(whatsappPreview(whatsappTemplateParameters(order, custom, "routine", defaults)), /Please call us if you need help with collection/);
});


test("opening an older order preserves long legacy notes without blocking unrelated message editing", () => {
  const older = { ...workspaceProps().reminder, customerNote: "Keep this historical note. ".repeat(10), deliveryEstimate: "An older courier estimate with additional detail. ".repeat(4) };
  const html = renderToStaticMarkup(createElement(OrderReminderMessageEditor, { order: { id: 1, ...order }, reminder: older, defaults: DEFAULT_REMINDER_MESSAGES, onSaved() {} }));
  assert.match(html, /Keep this historical note/); assert.match(html, /Your message to the customer/);
  assert.doesNotMatch(html, /must be .* characters or fewer|cannot be empty/);
});
