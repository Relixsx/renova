import { requireOwnerRequest } from "../../../lib/admin-auth";

function setting(name: string) {
  return process.env[name]?.trim();
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;

  const cloudName = setting("CLOUDINARY_CLOUD_NAME");
  const apiKey = setting("CLOUDINARY_API_KEY");
  const apiSecret = setting("CLOUDINARY_API_SECRET");
  if (!cloudName || !apiKey || !apiSecret) {
    return Response.json({ error: "Media storage is not configured. Add the three CLOUDINARY_* environment variables." }, { status: 503 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "renova/products";
  const signatureInput = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = hex(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(signatureInput)));

  return Response.json({ cloudName, apiKey, timestamp, folder, signature });
}
