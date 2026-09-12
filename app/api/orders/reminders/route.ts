import { reminderDashboardData, dispatchReminder, saveReminder, stopReminder } from "../../../lib/customer-reminders";
import { requireOwnerRequest } from "../../../lib/admin-auth";

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
    };
    const orderId = Math.floor(Number(body.orderId));
    if (!Number.isFinite(orderId) || orderId < 1) return Response.json({ error: "A valid order is required." }, { status: 400 });
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
    const delivery = await dispatchReminder(reminder.id, true, isArrival ? "arrival" : "routine");
    const message = isArrival
      ? "The arrival update was sent. Daily reminders remain active until you confirm collection."
      : body.action === "send_now" ? "Update saved and sent." : "Daily reminders started and the first update was sent.";
    return Response.json({ reminder, delivery, message });
  } catch (error) {
    console.error("Customer reminder action failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "The reminder action failed." }, { status: 500 });
  }
}
