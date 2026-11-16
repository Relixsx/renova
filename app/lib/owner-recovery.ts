import { getOwnerAuth, isOwnerEmail } from "./admin-auth";
import { siteOrigin, trustedOwnerOrigins } from "./owner-settings.mjs";

export async function recoverOwnerPassword(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !trustedOwnerOrigins().includes(origin)) return Response.json({ error: "Open password recovery from the Renova sign-in page." }, { status: 403 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 8192) return Response.json({ error: "The recovery request is too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid recovery request." }, { status: 400 }); }
  let path: string, payload: Record<string, unknown>;
  if (body.action === "request") {
    if (!process.env.RESEND_API_KEY || !(process.env.RESEND_FROM_EMAIL || process.env.ORDER_FROM_EMAIL)) return Response.json({ error: "Recovery email is temporarily unavailable. The owner can reset access using the private setup tool." }, { status: 503 });
    const email = String(body.email || "").trim().toLowerCase();
    let redirect: URL;
    try { redirect = new URL(String(body.redirectTo || "")); } catch { return Response.json({ error: "Invalid recovery request." }, { status: 400 }); }
    if (!trustedOwnerOrigins().includes(redirect.origin) || redirect.pathname !== "/admin/reset-password" || redirect.search || redirect.hash) return Response.json({ error: "Invalid recovery request." }, { status: 400 });
    if (!isOwnerEmail(email)) return Response.json({ ok: true });
    path = "request-password-reset"; payload = { email, redirectTo: redirect.toString() };
  } else if (body.action === "reset") {
    path = "reset-password"; payload = { token: String(body.token || ""), newPassword: String(body.newPassword || "") };
  } else return Response.json({ error: "Unknown recovery action." }, { status: 400 });
  const forwarded = new Headers({ "content-type": "application/json", origin });
  const cookie = request.headers.get("cookie");
  if (cookie) forwarded.set("cookie", cookie);
  // Use the real HTTP handler so its database-backed rate limits and CSRF
  // checks also apply to the existing Renova recovery form.
  return getOwnerAuth().handler(new Request(`${siteOrigin()}/api/auth/${path}`, { method: "POST", headers: forwarded, body: JSON.stringify(payload) }));
}
