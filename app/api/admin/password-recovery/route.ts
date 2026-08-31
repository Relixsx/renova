export const dynamic = "force-dynamic";

function ownerEmails() {
  const configured = process.env.ADMIN_EMAILS || "relixsx@gmail.com,airebirth5@gmail.com";
  return new Set(configured.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function neonAuthUrl(path: string) {
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) throw new Error("NEON_AUTH_BASE_URL is not configured.");
  return `${baseUrl}/${path}`;
}

async function forwardToNeon(path: string, body: Record<string, unknown>, origin: string) {
  return fetch(neonAuthUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": origin,
      "x-neon-auth-proxy": "nextjs",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const origin = new URL(request.url).origin;

    if (body.action === "request") {
      const email = String(body.email || "").trim().toLowerCase();
      const redirectTo = String(body.redirectTo || "");
      let redirectUrl: URL;

      try {
        redirectUrl = new URL(redirectTo);
      } catch {
        return Response.json({ error: "The recovery request is invalid." }, { status: 400 });
      }

      // Render receives the request behind Cloudflare, so request.url may use
      // Render's internal origin while redirectTo correctly uses ShopRenova.
      // Validate the public hostname forwarded by the proxies and the exact
      // recovery path instead of requiring both origins to be identical.
      const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
      const requestHost = request.headers.get("host")?.trim();
      const configuredSiteHost = process.env.NEXT_PUBLIC_SITE_URL
        ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host
        : "";
      const allowedHosts = new Set([
        new URL(request.url).host,
        forwardedHost,
        requestHost,
        configuredSiteHost,
        "shoprenova.com.ng",
        "www.shoprenova.com.ng",
        "localhost:5173",
      ].filter(Boolean));

      if (!email || redirectUrl.pathname !== "/admin/reset-password" || !allowedHosts.has(redirectUrl.host)) {
        return Response.json({ error: "The recovery request is invalid." }, { status: 400 });
      }

      // Always return the same response for unknown emails. This prevents the
      // recovery form from revealing which addresses have owner access.
      if (!ownerEmails().has(email)) return Response.json({ ok: true });

      const response = await forwardToNeon("request-password-reset", { email, redirectTo }, redirectUrl.origin);
      if (!response.ok) {
        const message = await response.text();
        console.error("Neon password-reset request failed.", response.status, message);
        return Response.json({ error: "Neon could not send the recovery email. Check Auth email settings and try again." }, { status: 502 });
      }

      return Response.json({ ok: true });
    }

    if (body.action === "reset") {
      const token = String(body.token || "");
      const newPassword = String(body.newPassword || "");
      if (!token || newPassword.length < 8) {
        return Response.json({ error: "The reset link or new password is invalid." }, { status: 400 });
      }

      const response = await forwardToNeon("reset-password", { token, newPassword }, origin);
      if (!response.ok) {
        const message = await response.text();
        console.error("Neon password reset failed.", response.status, message);
        return Response.json({ error: "This reset link is invalid or has expired. Request a new link." }, { status: 400 });
      }

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown recovery action." }, { status: 400 });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("Password recovery service failed.", error);
    return Response.json(
      { error: timedOut ? "Neon did not respond in time. Please try again." : "Password recovery is temporarily unavailable." },
      { status: timedOut ? 504 : 500 },
    );
  }
}
