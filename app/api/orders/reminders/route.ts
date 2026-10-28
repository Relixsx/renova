import { reminderDashboardData, dispatchReminder, saveReminder, stopReminder, reminderText } from "../../../lib/customer-reminders";
import { requireOwnerRequest } from "../../../lib/admin-auth";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orderReminders, orders } from "../../../../db/schema";
import { optOutWhatsApp, retryWhatsApp } from "../../../lib/whatsapp-notifications";
import { reminderMessageFields, whatsappPreview, whatsappTemplateParameters } from "../../../lib/whatsapp-message";
import { startOrderWhatsApp, stopOrderWhatsApp, WhatsAppControlError } from "../../../lib/whatsapp-order-controls";
import { confirmOrderArrival, reminderMessageDefaults, saveOrderMessageEdits, saveReminderMessageDefaults } from "../../../lib/reminder-message-settings";
import { mergeReminderMessageOverrides, parseMessageOverrides, ReminderMessageError, validateMessageDefaults, validateMessageOverrides } from "../../../lib/reminder-message-content";
import { nigeriaCalendarDate, validateJumiaDeliveryWindow } from "../../../lib/jumia-delivery-countdown";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  try { return Response.json(await reminderDashboardData()); }
  catch { return Response.json({ error: "Reminders could not be loaded. Check that the message-editor database update has been applied." }, { status: 500 }); }
}

type ReminderRequest = {
  action?: string; orderId?: number; consentConfirmed?: boolean;
  emailEnabled?: boolean; whatsappEnabled?: boolean; smsEnabled?: boolean;
  currentCheckpoint?: string; deliveryEstimate?: string; customerNote?: string;
  arrivalMessage?: string; arrivalCheckpoint?: string; arrivalConfirmed?: boolean;
  messageId?: number; checkedWhatsAppManager?: boolean; whatsappPhone?: string;
  messageOverrides?: unknown; messageDefaults?: unknown;
  jumiaDeliveryWindow?: unknown;
};

export async function POST(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  try {
    const raw = await request.text();
    if (raw.length > 16000) return Response.json({ error: "This message edit is too large." }, { status: 413 });
    let body: ReminderRequest;
    try { body = JSON.parse(raw) as ReminderRequest; } catch { throw new ReminderMessageError("Enter valid message settings."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ReminderMessageError("Enter valid message settings.");
    if (body.action === "save_message_defaults") {
      const messageDefaults = await saveReminderMessageDefaults(body.messageDefaults);
      return Response.json({ messageDefaults, message: "Daily and arrival defaults saved. No message was sent and no schedule was changed." });
    }
    const orderId = Number(body.orderId);
    if (!Number.isSafeInteger(orderId) || orderId < 1) throw new ReminderMessageError("A valid order is required.");
    const actions = ["start", "save", "send_now", "arrival", "activate_arrival", "stop", "start_whatsapp", "stop_whatsapp", "opt_out_whatsapp", "retry_whatsapp", "preview", "save_message_edits"];
    if (!actions.includes(body.action || "")) throw new ReminderMessageError("Choose a valid reminder action.");
    if (body.action === "start_whatsapp") {
      const result = await startOrderWhatsApp({ orderId, phone: String(body.whatsappPhone || ""), consentConfirmed: body.consentConfirmed === true });
      const status = result.delivery.status;
      const message = !result.changed ? "WhatsApp is already on. No extra message was sent."
        : status === "accepted" ? "WhatsApp is on. Meta accepted the first update; check its delivery receipt. The next daily update is due in 24 hours."
        : `WhatsApp is on. First update status: ${status}. Check the delivery status below; daily updates continue while this order is active.`;
      return Response.json({ ...result, message });
    }
    if (body.action === "stop_whatsapp") return Response.json({ ...await stopOrderWhatsApp(orderId), message: "WhatsApp is off for this order. You can restart it later. Other channels are unchanged." });
    if (body.action === "retry_whatsapp") {
      const messageId = Number(body.messageId);
      if (!Number.isSafeInteger(messageId) || messageId < 1) throw new ReminderMessageError("Choose a valid WhatsApp message.");
      const delivery = await retryWhatsApp(messageId, body.checkedWhatsAppManager === true);
      return Response.json({ delivery, message: `WhatsApp message status: ${delivery.status}.` });
    }
    if (body.action === "save_message_edits") {
      const reminder = await saveOrderMessageEdits(orderId, body.messageOverrides === undefined ? {} : body.messageOverrides, body.currentCheckpoint, body.arrivalCheckpoint, body.jumiaDeliveryWindow);
      return Response.json({ reminder, message: "Message settings and any Jumia date edits saved for this order. No message was sent and its schedule is unchanged." });
    }
    if (body.action === "arrival" || body.action === "activate_arrival") {
      const arrivalCheckpoint = body.arrivalCheckpoint ?? body.arrivalMessage;
      if (body.arrivalConfirmed !== true || typeof arrivalCheckpoint !== "string" || !arrivalCheckpoint.trim() || arrivalCheckpoint.trim().length > 500) throw new ReminderMessageError("Confirm the parcel has arrived and enter the verified collection information first.");
      if (body.messageOverrides !== undefined || body.jumiaDeliveryWindow !== undefined) await saveOrderMessageEdits(orderId, body.messageOverrides === undefined ? {} : body.messageOverrides, undefined, arrivalCheckpoint, body.jumiaDeliveryWindow);
      const result = await confirmOrderArrival(orderId, arrivalCheckpoint, true);
      const delivery = result.changed && result.reminder.active ? await dispatchReminder(result.reminder.id, false, "arrival") : undefined;
      const [reminder] = await getDb().select().from(orderReminders).where(eq(orderReminders.id, result.reminder.id)).limit(1);
      const message = !result.changed ? "Arrival reminders are already selected. No extra message was sent."
        : !reminder.active ? "Arrival recorded. Notifications remain off; restart the selected channels when ready."
        : delivery?.skipped ? `Arrival recorded. ${delivery.reason}`
        : "Arrival reminders started. Check delivery status below. The next reminder waits 24 hours; collection or stop ends the reminders.";
      return Response.json({ reminder, changed: result.changed, delivery, message });
    }
    if (body.action === "opt_out_whatsapp" || body.action === "preview") {
      const [order] = await getDb().select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) throw new ReminderMessageError("Order not found.", 404);
      if (body.action === "opt_out_whatsapp") {
        await optOutWhatsApp(order.whatsappPhone || order.customerPhone);
        return Response.json({ message: "WhatsApp updates stopped for this number's current orders. Other selected channels remain available." });
      }
      const [saved] = await getDb().select().from(orderReminders).where(eq(orderReminders.orderId, orderId)).limit(1);
      const defaults = body.messageDefaults === undefined ? await reminderMessageDefaults() : validateMessageDefaults(body.messageDefaults);
      const overrides = body.messageOverrides === undefined ? {} : validateMessageOverrides(body.messageOverrides);
      const dates = body.jumiaDeliveryWindow === undefined ? undefined : validateJumiaDeliveryWindow(body.jumiaDeliveryWindow);
      const previewNow = new Date();
      const draft = {
        ...saved,
        currentCheckpoint: String(body.currentCheckpoint ?? saved?.currentCheckpoint ?? ""),
        customerNote: String(body.customerNote ?? saved?.customerNote ?? ""),
        deliveryEstimate: String(body.deliveryEstimate ?? saved?.deliveryEstimate ?? ""),
        arrivalCheckpoint: String(body.arrivalCheckpoint ?? saved?.arrivalCheckpoint ?? ""),
        messageOverridesJson: JSON.stringify(mergeReminderMessageOverrides(parseMessageOverrides(saved?.messageOverridesJson), overrides)),
        ...(dates ? { jumiaDeliveryFrom: dates.from, jumiaDeliveryTo: dates.to } : {}),
      };
      const confirmationPreview = whatsappPreview(whatsappTemplateParameters({ ...order, status: "confirmed" }, { currentCheckpoint: "", customerNote: "", deliveryEstimate: "" }, "confirmation"));
      const dailyParameters = whatsappTemplateParameters(order, draft, "routine", defaults, previewNow);
      const arrivalParameters = whatsappTemplateParameters(order, draft, "arrival", defaults, previewNow);
      const preview = whatsappPreview(dailyParameters);
      const arrivalPreview = whatsappPreview(arrivalParameters);
      const editorMessage = (parameters: [string, string, string, string], arrival: boolean) => ({
        body: parameters[2].replace(/\s*Reply STOP to stop WhatsApp updates\.$/, ""),
        maxLength: Math.min(700, 1024 - whatsappPreview([parameters[0], parameters[1], "", parameters[3]]).length - (arrival ? " Reply STOP to stop WhatsApp updates.".length : 0)),
        estimate: parameters[3],
      });
      return Response.json({ preview, confirmationPreview, arrivalPreview,
        messageEditors: { routine: editorMessage(dailyParameters, false), arrival: editorMessage(arrivalParameters, true) },
        previewNigeriaDate: nigeriaCalendarDate(previewNow),
        smsPreviews: { routine: reminderText(order, draft, "routine", defaults, previewNow), arrival: reminderText(order, draft, "arrival", defaults, previewNow) },
        emailPreviews: { routine: reminderMessageFields(order, draft, "routine", defaults, previewNow), arrival: reminderMessageFields(order, draft, "arrival", defaults, previewNow) },
        message: "Previews only. No message was sent and arrival has not been confirmed by previewing." });
    }
    if (body.action === "stop") return Response.json({ reminder: await stopReminder(orderId), message: "All reminder channels stopped for this order." });
    const reminder = await saveReminder({ orderId, consentConfirmed: body.consentConfirmed === true,
      emailEnabled: body.emailEnabled === true, whatsappEnabled: body.whatsappEnabled === true, smsEnabled: body.smsEnabled === true,
      currentCheckpoint: String(body.currentCheckpoint ?? ""), deliveryEstimate: String(body.deliveryEstimate ?? ""), customerNote: String(body.customerNote ?? ""), start: true });
    if (body.action === "save") return Response.json({ reminder, message: "Saved for the next scheduled update. No message was sent." });
    const delivery = await dispatchReminder(reminder.id, body.action !== "start");
    const message = delivery.skipped ? `Saved. ${delivery.reason}` : `Reminder saved. ${delivery.sent || 0} channel(s) accepted the update. WhatsApp delivery is confirmed separately by receipts.`;
    return Response.json({ reminder, delivery, message });
  } catch (error) {
    if (error instanceof WhatsAppControlError || error instanceof ReminderMessageError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Customer reminder action failed");
    return Response.json({ error: "The reminder action failed. Check the message settings and database update." }, { status: 500 });
  }
}
