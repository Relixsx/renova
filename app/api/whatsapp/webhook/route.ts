import { equalSecret, limitedWebhookBody, verifyWhatsAppSignature } from "../../../lib/whatsapp-webhook-security";
import { isWhatsAppStop } from "../../../lib/whatsapp-message";
import { optOutWhatsApp, recordWhatsAppStatus } from "../../../lib/whatsapp-notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!expected) return new Response("Webhook not configured", { status: 503 });
  const query = new URL(request.url).searchParams;
  if (query.get("hub.mode") !== "subscribe" || !await equalSecret(query.get("hub.verify_token") || "", expected)) return new Response("Forbidden", { status: 403 });
  return new Response(query.get("hub.challenge") || "", { headers: { "content-type": "text/plain" } });
}

type WhatsAppEvent = { object?: string; entry?: Array<{ changes?: Array<{ field?: string; value?: {
  metadata?: { phone_number_id?: string };
  statuses?: Array<{ id?: string; status?: string; errors?: Array<{ code?: number }> }>;
  messages?: Array<{ from?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string } } }>;
} }> }> };

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!secret || !phoneId) return new Response("Webhook not configured", { status: 503 });
  let raw: Uint8Array<ArrayBuffer>;
  try { raw = await limitedWebhookBody(request); }
  catch { return new Response("Payload too large", { status: 413 }); }
  if (!await verifyWhatsAppSignature(raw, request.headers.get("x-hub-signature-256") || "", secret)) return new Response("Invalid signature", { status: 401 });
  let event: WhatsAppEvent;
  try { event = JSON.parse(new TextDecoder().decode(raw)) as WhatsAppEvent; }
  catch { return new Response("Invalid JSON", { status: 400 }); }
  if (event?.object !== "whatsapp_business_account") return Response.json({ received: true });
  try {
    for (const entry of event.entry || []) for (const change of entry.changes || []) {
      const value = change.value;
      if (change.field !== "messages" || value?.metadata?.phone_number_id !== phoneId) continue;
      for (const message of value.messages || []) {
        const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || "";
        if (message.from && isWhatsAppStop(text)) await optOutWhatsApp(message.from);
      }
      for (const receipt of value.statuses || []) if (receipt.id && receipt.status) await recordWhatsAppStatus(receipt.id, receipt.status, receipt.errors?.[0]?.code);
    }
    return Response.json({ received: true });
  } catch {
    // A non-2xx response asks Meta to retry; never acknowledge a STOP that was
    // lost to a database outage. Do not log customer message contents or secrets.
    console.error("WhatsApp webhook processing failed; Meta should retry.");
    return new Response("Please retry", { status: 503 });
  }
}
