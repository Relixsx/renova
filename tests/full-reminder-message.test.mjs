import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const load = (name) => import(pathToFileURL(join(process.env.RENOVA_TEST_BUILD, `${name}.mjs`)));
const { DEFAULT_REMINDER_MESSAGES, resolveReminderMessageDraft, validateMessageOverrides } = await load("app/lib/reminder-message-content");
const { whatsappTemplateParameters, whatsappPreview, prepareFullReminderMessage, reminderMessageFields } = await load("app/lib/whatsapp-message");
const { reminderText } = await load("app/lib/customer-reminders");
const order = { customerName: "Amina Example", orderNumber: "REN-EDIT-001", customerPhone: "08000000000", status: "confirmed", paymentMethod: "cash_on_delivery", paymentStatus: "payment_due_on_delivery", totalKobo: 3370000, itemsJson: '[{"name":"Foldable phone","quantity":1}]', addressJson: '{"stateCode":"OG"}', estimatedDelivery: "3–12 working days" };
const reminder = { currentCheckpoint: "", customerNote: "", deliveryEstimate: "", jumiaDeliveryFrom: "2026-11-06", jumiaDeliveryTo: "2026-11-10" };

test("unfinished draft text, deletion, spaces and line breaks stay editable without reverting to defaults", () => {
  for (const text of ["", " ", "Replacement ", "Replacement wording\n", "Unfinished {{first_"]) {
    const config = resolveReminderMessageDraft("routine", reminder, DEFAULT_REMINDER_MESSAGES, { routine: { message: text, fullMessage: text } });
    assert.equal(config.message, text); assert.equal(config.fullMessage, text);
  }
  assert.throws(() => validateMessageOverrides({ routine: { fullMessage: "" } }), /cannot be empty/);
  assert.throws(() => validateMessageOverrides({ routine: { fullMessage: "{{unknown}}" } }), /Unknown/);
});

test("the complete customer paragraph accepts two products and ₦58,000 without appending the old items or amount", () => {
  const body = "Thank you for your patience. Items: 1 × Foldable phone and 1 × Portable speaker. ₦58,000 is due when you receive your order.";
  const saved = { ...reminder, messageOverridesJson: JSON.stringify({ routine: { fullMessage: body } }) };
  const parameters = whatsappTemplateParameters(order, saved, "routine", undefined, new Date("2026-10-28T08:00:00Z"));
  assert.equal(parameters[2], body); assert.doesNotMatch(parameters[2], /33,700|Reply STOP/);
  assert.match(parameters[3], /6–10 November 2026 · \*9 days remaining until the delivery window starts\.\*/);
  assert.ok(whatsappPreview(parameters).length <= 1024);
  const email = reminderMessageFields(order, saved, "routine");
  assert.equal(email.message, body); assert.equal(email.fullMessage, true);
  const sms = reminderText(order, saved); assert.match(sms, /₦58,000/); assert.doesNotMatch(sms, /33,700/);
  assert.equal(order.totalKobo, 3370000); assert.match(order.itemsJson, /"quantity":1/);
});

test("full-message edits keep a separately bold 9, 8, 7 day countdown at sending time", () => {
  const saved = { ...reminder, messageOverridesJson: '{"routine":{"fullMessage":"Thank you. Items: two products. ₦58,000 is due on delivery."}}' };
  for (const [day, count] of [["2026-10-28", 9], ["2026-10-29", 8], ["2026-10-30", 7]]) {
    const parameters = whatsappTemplateParameters(order, saved, "routine", undefined, new Date(`${day}T08:00:00Z`));
    assert.match(parameters[3], new RegExp(`\\*${count} days remaining`));
    assert.doesNotMatch(parameters[2], /days remaining|expected in|Reply STOP/);
    assert.match(parameters[2], /₦58,000/);
  }
  const inWindow = whatsappTemplateParameters(order, saved, "routine", undefined, new Date("2026-11-06T08:00:00Z"));
  assert.match(inWindow[3], /window is open/); assert.doesNotMatch(inWindow[3], /has arrived|ready for collection/);
  const overdue = whatsappTemplateParameters(order, saved, "routine", undefined, new Date("2026-11-11T08:00:00Z"));
  assert.match(overdue[3], /estimate passed/); assert.doesNotMatch(overdue[3], /-\d|has arrived/);
});

test("untouched facts stay dynamic while a deliberate edited amount remains the owner's correction", () => {
  const initial = "Your order has been received and is being processed. Items: 1 × Foldable phone. ₦33,700 is due when you receive your order.";
  const template = prepareFullReminderMessage(initial, order, reminder, "routine");
  assert.match(template, /{{status_update}}/); assert.match(template, /{{order_items}}/); assert.match(template, /{{payment_details}}/);
  const changed = prepareFullReminderMessage(initial.replace("₦33,700", "₦58,000"), order, reminder, "routine");
  assert.match(changed, /₦58,000/); assert.doesNotMatch(changed, /{{payment_details}}/);
  const parameters = whatsappTemplateParameters({ ...order, status: "dispatched" }, { ...reminder, messageOverridesJson: JSON.stringify({ routine: { fullMessage: changed } }) }, "routine");
  assert.match(parameters[2], /dispatched and is on the way/); assert.match(parameters[2], /₦58,000/); assert.doesNotMatch(parameters[2], /received and is being processed|33,700/);
});

test("printed STOP instructions are arrival-only and edited overlong bodies are rejected without silently cutting amounts", () => {
  for (const kind of ["confirmation", "routine", "activation"]) assert.doesNotMatch(whatsappTemplateParameters(order, reminder, kind)[2], /Reply STOP/);
  for (const kind of ["arrival", "arrival_reminder"]) assert.match(whatsappTemplateParameters(order, reminder, kind)[2], /Reply STOP/);
  assert.match(whatsappTemplateParameters(order, { ...reminder, reminderPhase: "arrival" }, "activation")[2], /Reply STOP/);
  assert.throws(() => whatsappTemplateParameters({ ...order, orderNumber: "R".repeat(64), customerName: "A".repeat(40) }, { ...reminder, messageOverridesJson: JSON.stringify({ routine: { fullMessage: "A".repeat(690) + " ₦58,000" } }) }, "routine"), /too long/);
});
