import { reminderDashboardData, dispatchReminder, saveReminder, stopReminder } from "../../../lib/customer-reminders";
import { requireOwnerRequest } from "../../../lib/admin-auth";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { optOutWhatsApp, retryWhatsApp } from "../../../lib/whatsapp-notifications";
import { whatsappPreview, whatsappTemplateParameters } from "../../../lib/whatsapp-message";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  try {
    return Response.json(await reminderDashboardData());
  } catch (error) {
    console.error("Unable to load customer reminders", error);
    return Response.json({ error: error instanceof Error ? error.message : "Reminders could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
  try {
    const body = await request.json() as {
      action?: string;
      orderId?: number;
      consentConfirmed?: boolean;
      emailEnabled?: boolean;
      whatsappEnabled?: boolean;
      smsEnabled?: boolean;
      currentCheckpoint?: string;
      deliveryEstimate?: string;
      customerNote?: string;
      arrivalMessage?: string;
      messageId?: number;
      checkedWhatsAppManager?: boolean;
    };
    const orderId = Math.floor(Number(body.orderId));
    if (!Number.isFinite(orderId) || orderId < 1) return Response.json({ error: "A valid order is required." }, { status: 400 });
    if (!["start", "save", "send_now", "arrival", "stop", "opt_out_whatsapp", "retry_whatsapp", "preview"].includes(body.action || "")) return Response.json({ error: "Choose a valid reminder action." }, { status: 400 });
    if (body.action === "retry_whatsapp") {
      const messageId = Number(body.messageId);
      if (!Number.isSafeInteger(messageId) || messageId < 1) return Response.json({ error: "Choose a valid WhatsApp message." }, { status: 400 });
      const delivery = await retryWhatsApp(messageId, body.checkedWhatsAppManager === true);
      return Response.json({ message: `WhatsApp message status: ${delivery.status}.`, delivery });
    }
    if (body.action === "opt_out_whatsapp" || body.action === "preview") {
      const [order] = await getDb().select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
      if (body.action === "opt_out_whatsapp") {
        await optOutWhatsApp(order.whatsappPhone || order.customerPhone);
        return Response.json({ message: "WhatsApp updates stopped for this number's current orders. Other selected channels remain available." });
      }
      const preview = whatsappPreview(whatsappTemplateParameters(order, {
        currentCheckpoint: String(body.currentCheckpoint || ""), customerNote: String(body.customerNote || ""), deliveryEstimate: String(body.deliveryEstimate || ""),
      }, "routine"));
      return Response.json({ preview, message: "Preview only. No message was sent." });
    }
    if (body.action === "stop") {
      const reminder = await stopReminder(orderId);
      return Response.json({ reminder, message: "Daily reminders stopped." });
    }
    const isArrival = body.action === "arrival";
    const arrivalMessage = String(body.arrivalMessage ?? "").trim();
    if (isArrival && !arrivalMessage) return Response.json({ error: "Paste the verified Jumia arrival message first." }, { status: 400 });
    const reminder = await saveReminder({
      orderId,
      consentConfirmed: body.consentConfirmed === true,
      emailEnabled: body.emailEnabled === true,
      whatsappEnabled: body.whatsappEnabled === true,
      smsEnabled: body.smsEnabled === true,
      currentCheckpoint: isArrival ? arrivalMessage : String(body.currentCheckpoint ?? ""),
      deliveryEstimate: String(body.deliveryEstimate ?? ""),
      customerNote: String(body.customerNote ?? ""),
      start: true,
    });
    if (body.action === "save") return Response.json({ reminder, message: "Saved for the next scheduled update. No message was sent." });
    const delivery = await dispatchReminder(reminder.id, body.action !== "start", isArrival ? "arrival" : "routine");
    const message = delivery.skipped ? `Saved. ${delivery.reason}`
      : `${isArrival ? "Arrival update saved." : "Daily reminder saved."} ${delivery.sent || 0} channel(s) accepted the update. WhatsApp delivery is confirmed separately by receipts. Check the status below for queued or failed messages.`;
    return Response.json({ reminder, delivery, message });
  } catch (error) {
    console.error("Customer reminder action failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "The reminder action failed." }, { status: 500 });
  }
}
