import { createNeonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";

function requiredSetting(name: "NEON_AUTH_BASE_URL" | "NEON_AUTH_COOKIE_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export const auth = createNeonAuth({
  baseUrl: requiredSetting("NEON_AUTH_BASE_URL"),
  cookies: { secret: requiredSetting("NEON_AUTH_COOKIE_SECRET"), sessionDataTtl: 300 },
});

function ownerEmails() {
  const configured = process.env.ADMIN_EMAILS || "relixsx@gmail.com,airebirth5@gmail.com";
  return new Set(configured.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export function isOwnerEmail(email: string | null | undefined) {
  return Boolean(email && ownerEmails().has(email.trim().toLowerCase()));
}

export async function currentUser() {
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
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
