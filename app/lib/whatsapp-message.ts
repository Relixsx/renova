import { standardDeliveryEstimate } from "./delivery-estimate";
import { jumiaDeliveryCountdown } from "./jumia-delivery-countdown";
import { DEFAULT_REMINDER_MESSAGES, hasCustomDeliveryLine, renderMessageField, resolveReminderMessage, type MessageDefaults, type ReminderMessageSource } from "./reminder-message-content";

export type WhatsAppKind = "confirmation" | "routine" | "arrival" | "arrival_reminder" | "activation";
export type MessageOrder = {
  customerName: string; orderNumber: string; customerPhone: string;
  status: string; paymentMethod: string; paymentStatus: string;
  totalKobo: number; itemsJson: string; estimatedDelivery?: string | null; addressJson?: string | null;
};
export type MessageReminder = { currentCheckpoint: string; customerNote: string; deliveryEstimate: string } & ReminderMessageSource;

export const TERMINAL_ORDER_STATUSES = new Set(["delivered", "collected", "cancelled", "refunded"]);
export const ACCEPTED_WHATSAPP_STATUSES = ["accepted", "sent", "delivered", "read"];
export const DAY_MS = 24 * 60 * 60 * 1000;

export function confirmedOrder(order: Pick<MessageOrder, "status" | "paymentMethod" | "paymentStatus">) {
  return ["confirmed", "processing", "packaged", "dispatched"].includes(order.status)
    && (order.paymentMethod === "cash_on_delivery" || order.paymentStatus === "paid");
}

export function phoneForWhatsApp(value: string) {
  let digits = value.trim().replace(/[\s()+.-]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^0[789]\d{9}$/.test(digits)) digits = `234${digits.slice(1)}`;
  else if (/^[789]\d{9}$/.test(digits)) digits = `234${digits}`;
  if (!/^[1-9]\d{9,14}$/.test(digits) || (digits.startsWith("234") && !/^234[789]\d{9}$/.test(digits))) {
    throw new Error("Enter a valid WhatsApp number, including the country code for numbers outside Nigeria.");
  }
  return digits;
}

export function cleanMessageText(value: string, max: number) {
  const text = value.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function orderStageText(status: string) {
  switch (status) {
    case "confirmed": return "Your order has been received and is being processed.";
    case "processing": return "Your order is being prepared for dispatch.";
    case "packaged": return "Your order has been packaged and is awaiting handover to the delivery partner.";
    case "dispatched": return "Your order has been dispatched and is on the way. Please be ready to receive your parcel.";
    default: return "We will share a delivery update once your order is confirmed.";
  }
}

export function paymentText(order: Pick<MessageOrder, "paymentMethod" | "paymentStatus" | "totalKobo">) {
  const amount = `₦${(order.totalKobo / 100).toLocaleString("en-NG")}`;
  if (order.paymentMethod === "cash_on_delivery") return `${amount} is due when you receive your order.`;
  return order.paymentStatus === "paid" ? `Payment of ${amount} has been received.` : "Payment is awaiting confirmation.";
}

function itemSummary(json: string) {
  try {
    const items: Array<{ name?: string; quantity?: number }> = JSON.parse(json);
    if (!Array.isArray(items) || !items.length) return "";
    const names = items.slice(0, 2).map((item) => `${Math.max(1, Number(item.quantity) || 1)} × ${cleanMessageText(item.name || "item", 35)}`).join(", ");
    return `Items: ${names}${items.length > 2 ? ` and ${items.length - 2} more` : ""}.`;
  } catch { return ""; }
}

export function reminderMessageFields(order: MessageOrder, reminder: MessageReminder, kind: WhatsAppKind, defaults: MessageDefaults = DEFAULT_REMINDER_MESSAGES, now: Date = new Date()) {
  const arrival = kind === "arrival" || kind === "arrival_reminder" || (kind === "activation" && reminder.reminderPhase === "arrival");
  const jumiaWindow = jumiaDeliveryCountdown(reminder, now);
  const countdown = arrival ? null : jumiaWindow;
  const config = resolveReminderMessage(arrival ? "arrival" : "routine", reminder, defaults);
  const checkpoint = cleanMessageText(arrival ? reminder.arrivalCheckpoint ?? reminder.currentCheckpoint : reminder.currentCheckpoint, 180);
  const variables = {
    first_name: cleanMessageText(order.customerName.trim().split(/\s+/)[0] || "there", 40),
    customer_name: cleanMessageText(order.customerName, 80),
    order_number: cleanMessageText(order.orderNumber, 64),
    status_update: orderStageText(order.status),
    courier_update: checkpoint ? `${arrival ? "" : "Courier update: "}${checkpoint}` : "",
    tracking_url: "https://shoprenova.com.ng/track-order",
    delivery_countdown: countdown?.message || "",
    jumia_delivery_window: jumiaWindow?.dateLabel || "",
  };
  let message = renderMessageField(config.message, variables);
  if (countdown) {
    // The countdown stays first even if the owner omits its variable or uses
    // long custom wording. A duplicated variable in the message is removed.
    const custom = message.replaceAll(countdown.message, "").replace(/\s+/g, " ").trim();
    const paymentReminder = order.paymentMethod === "cash_on_delivery" && countdown.state !== "overdue" ? "Please keep your payment ready for delivery." : "";
    message = [countdown.message, paymentReminder, custom].filter(Boolean).join(" ");
  }
  if (!message) message = arrival ? renderMessageField(DEFAULT_REMINDER_MESSAGES.arrival.message, variables) : orderStageText(order.status);
  const enteredEstimate = renderMessageField(config.deliveryEstimate, variables);
  const estimate = enteredEstimate && hasCustomDeliveryLine(arrival ? "arrival" : "routine", reminder, defaults)
    ? enteredEstimate
    : arrival && !enteredEstimate ? DEFAULT_REMINDER_MESSAGES.arrival.deliveryEstimate
    : standardDeliveryEstimate(enteredEstimate || order.estimatedDelivery, order.addressJson);
  return {
    message,
    estimate: cleanMessageText(countdown?.dateLabel || estimate, 110),
    note: renderMessageField(config.note, variables),
    subject: cleanMessageText(renderMessageField(config.emailSubject, variables), 160),
    heading: renderMessageField(config.emailHeading, variables),
    countdown,
  };
}

// Exactly the four body variables of the existing approved English (en)
// renova_delivery_update template. Never put test order values in production.
export function whatsappTemplateParameters(order: MessageOrder, reminder: MessageReminder, kind: WhatsAppKind, defaults: MessageDefaults = DEFAULT_REMINDER_MESSAGES, now: Date = new Date()): [string, string, string, string] {
  const name = cleanMessageText(order.customerName.trim().split(/\s+/)[0] || "there", 40);
  const number = cleanMessageText(order.orderNumber, 64);
  if (kind !== "confirmation") {
    const fields = reminderMessageFields(order, reminder, kind, defaults, now);
    const stop = "Reply STOP to stop WhatsApp updates.";
    const facts = [itemSummary(order.itemsJson), paymentText(order)].filter(Boolean).join(" ");
    const available = 1024 - whatsappPreview([name, number, "", fields.estimate]).length - stop.length - 1;
    // Keep order facts and STOP intact. The exact bounded body is also used by
    // previews; long expanded wording never produces a different handset copy.
    const messageRoom = Math.max(1, available - facts.length - 1);
    const prose = [fields.message, fields.note].filter(Boolean).join(" ");
    return [name, number, `${cleanMessageText(prose, messageRoom)} ${facts} ${stop}`, fields.estimate];
  }
  // Confirmation wording is independent of every editable reminder field.
  reminder = { currentCheckpoint: "", customerNote: "", deliveryEstimate: "" };
  const estimate = cleanMessageText(standardDeliveryEstimate(reminder.deliveryEstimate || order.estimatedDelivery, order.addressJson), 110);
  const opening = `Thank you for choosing Renova! ${orderStageText(order.status)}`;
  const stop = "Reply STOP to stop WhatsApp updates.";
  // Keep the order summary and payment amount ahead of optional notes. Bound
  // the whole expanded body, not just individual template variables.
  const essentials = [opening, itemSummary(order.itemsJson), paymentText(order)].filter(Boolean).join(" ");
  const available = Math.min(440, 1024 - whatsappPreview([name, number, "", estimate]).length - stop.length - 1);
  const content = essentials;
  const update = `${cleanMessageText(content, available)} ${stop}`;
  return [name, number, update, estimate];
}

// Useful for the owner preview and tests; this is the unchanged approved body.
export function whatsappPreview(parameters: [string, string, string, string]) {
  const [name, number, update, estimate] = parameters;
  return `Hello ${name},\n\nHere is the latest update for your Renova order ${number}:\n\n${update}\n\nExpected delivery: ${estimate}\n\nPlease keep your phone available so the courier can reach you. You do not need to place another order.\n\nThank you for shopping with Renova.`;
}

export function isWhatsAppStop(text: string) {
  return /^(?:stop|unsubscribe|stop updates)[.!]?$/i.test(text.trim());
}
