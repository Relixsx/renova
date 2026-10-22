export type WhatsAppKind = "confirmation" | "routine" | "arrival";
export type MessageOrder = {
  customerName: string; orderNumber: string; customerPhone: string;
  status: string; paymentMethod: string; paymentStatus: string;
  totalKobo: number; itemsJson: string; estimatedDelivery?: string | null;
};
export type MessageReminder = { currentCheckpoint: string; customerNote: string; deliveryEstimate: string };

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
    case "confirmed": return "Your order is confirmed. We are arranging its preparation.";
    case "processing": return "Your order is being prepared for dispatch.";
    case "packaged": return "Your order has been packaged and is awaiting handover to the delivery partner.";
    case "dispatched": return "Your order has been dispatched and is on the way. Please keep your phone available for the courier.";
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
    const names = items.slice(0, 2).map((item) => `${Math.max(1, Number(item.quantity) || 1)} × ${cleanMessageText(item.name || "item", 45)}`).join(", ");
    return `Items: ${names}${items.length > 2 ? ` and ${items.length - 2} more` : ""}.`;
  } catch { return ""; }
}

// Exactly the four body variables of the existing approved English (en)
// renova_delivery_update template. Never put test order values in production.
export function whatsappTemplateParameters(order: MessageOrder, reminder: MessageReminder, kind: WhatsAppKind): [string, string, string, string] {
  const name = cleanMessageText(order.customerName.trim().split(/\s+/)[0] || "there", 40);
  const number = cleanMessageText(order.orderNumber, 64);
  const estimate = cleanMessageText(reminder.deliveryEstimate || order.estimatedDelivery || "We will share an estimate when the delivery partner confirms it.", 110);
  const checkpoint = cleanMessageText(reminder.currentCheckpoint, 160);
  const note = cleanMessageText(reminder.customerNote, 100);
  const opening = kind === "confirmation"
    ? `Your order is confirmed. Thank you for choosing Renova! ${itemSummary(order.itemsJson)} ${order.status === "confirmed" ? "We are arranging its preparation." : orderStageText(order.status)}`
    : checkpoint ? `Latest recorded delivery update: ${checkpoint}` : orderStageText(order.status);
  const stop = "Reply STOP to stop WhatsApp updates.";
  const content = [opening, paymentText(order), kind === "confirmation" && checkpoint ? `Delivery note: ${checkpoint}` : "", note].filter(Boolean).join(" ");
  const update = `${cleanMessageText(content, 440)} ${stop}`;
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
