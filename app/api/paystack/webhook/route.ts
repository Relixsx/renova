import { markOrderPaid, paystackSecret } from "../../../lib/order-payment";

function toHex(bytes: ArrayBuffer) { return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

export async function POST(request: Request) {
  const secret = paystackSecret();
  if (!secret) return new Response("Not configured", { status: 503 });
  const body = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const digest = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  if (signature.length !== digest.length || signature !== digest) return new Response("Invalid signature", { status: 401 });
  const event = JSON.parse(body) as { event?: string; data?: { reference?: string; amount?: number; status?: string } };
  if (event.event === "charge.success" && event.data?.reference && event.data.status === "success") await markOrderPaid(event.data.reference, Number(event.data.amount ?? 0));
  return new Response("OK");
}
