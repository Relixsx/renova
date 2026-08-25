import { createNeonAuth } from "@neondatabase/auth/next/server";
import {
  extractNeonAuthCookies,
  parseSessionData,
} from "@neondatabase/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function requiredSetting(name: "NEON_AUTH_BASE_URL" | "NEON_AUTH_COOKIE_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

type NeonAuth = ReturnType<typeof createNeonAuth>;

let authInstance: NeonAuth | null = null;

/**
 * Initialise Neon Auth only when an auth route is actually used. Keeping this
 * lazy allows public pages and production-render tests to run without loading
 * private authentication configuration.
 */
export function getAuth() {
  if (!authInstance) {
    authInstance = createNeonAuth({
      baseUrl: requiredSetting("NEON_AUTH_BASE_URL"),
      cookies: {
        secret: requiredSetting("NEON_AUTH_COOKIE_SECRET"),
        sessionDataTtl: 300,
      },
    });
  }

  return authInstance;
}

function ownerEmails() {
  const configured = process.env.ADMIN_EMAILS || "relixsx@gmail.com,airebirth5@gmail.com";
  return new Set(configured.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export function isOwnerEmail(email: string | null | undefined) {
  return Boolean(email && ownerEmails().has(email.trim().toLowerCase()));
}

export async function currentUser() {
  const headerStore = await headers();
  const authCookies = extractNeonAuthCookies(headerStore);

  if (!authCookies.includes("session_token=")) return null;

  try {
    const baseUrl = requiredSetting("NEON_AUTH_BASE_URL").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/get-session`, {
      headers: {
        cookie: authCookies,
        "x-neon-auth-proxy": "nextjs",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) return null;

    const session = parseSessionData(await response.json());
    return session.user;
  } catch (error) {
    console.error("Unable to validate the Neon Auth session.", error);
    return null;
  }
}

export async function requireOwnerPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/login?returnTo=/admin");
  return { user, authorised: isOwnerEmail(user.email) };
}

export async function requireOwnerRequest(_request?: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (!isOwnerEmail(user.email)) {
    return Response.json({ error: "This account is not authorised for Renova administration." }, { status: 403 });
  }
  return null;
}
