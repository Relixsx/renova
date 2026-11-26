import { diagnosticEvents, webVitals } from "../../../lib/anagen-diagnostics";
import { SITE_URL } from "../../../lib/site";
import { limitedWebhookBody } from "../../../lib/whatsapp-webhook-security";

const headers = { "Cache-Control": "no-store" };
let windowMinute = 0;
let observations = 0;

export async function POST(request: Request) {
  if (process.env.RENOVA_ANAGEN_DIAGNOSTICS !== "1") return new Response(null, { status: 404, headers });
  if (request.headers.get("origin") !== SITE_URL) return new Response(null, { status: 403, headers });
  let body: { name?: unknown; value?: unknown } | null;
  try {
    body = JSON.parse(new TextDecoder().decode(await limitedWebhookBody(request, 256)));
  } catch {
    return new Response(null, { status: 400, headers });
  }
  const name = body?.name;
  const value = body?.value;
  const metric = webVitals.find(candidate => candidate === name);
  const event = diagnosticEvents.find(candidate => candidate === name);
  if ((!metric && !event) || (metric && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > (metric === "CLS" ? 10 : 120_000)))) {
    return new Response(null, { status: 400, headers });
  }
  const minute = Math.floor(Date.now() / 60_000);
  if (minute !== windowMinute) { windowMinute = minute; observations = 0; }
  if (observations < 60) {
    observations += 1;
    console.info(JSON.stringify({ event: "anagen3_diagnostic", name, ...(metric ? { value } : {}) }));
  }
  return new Response(null, { status: 204, headers });
}
