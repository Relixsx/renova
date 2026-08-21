import { env } from "cloudflare:workers";
import { requireOwnerRequest } from "../../../lib/admin-auth";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 15 * 1024 * 1024;

function setting(name: string) {
  return (env as unknown as Record<string, string | undefined>)[name]?.trim();
}

function decodeBase64(value: string) {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

const MODE_PROMPTS: Record<string, string> = {
  studio: "Place the product in a clean premium ecommerce studio with a warm off-white background, balanced soft lighting, a natural contact shadow, accurate white balance and crisp detail.",
  natural: "Improve the lighting and clarity while keeping the original natural setting believable, tidy and premium.",
  background: "Remove visual clutter and use a clean neutral ecommerce background with a subtle realistic contact shadow.",
};

export async function POST(request: Request) {
  const denied = requireOwnerRequest(request);
  if (denied) return denied;
  if (!env.BUCKET) return Response.json({ error: "Media storage is not configured." }, { status: 503 });
  const apiKey = setting("OPENAI_API_KEY");
  if (!apiKey) return Response.json({ error: "Local optimization is ready. Add OPENAI_API_KEY to enable AI enhancement." }, { status: 503 });

  const input = await request.formData();
  const file = input.get("file");
  const mode = String(input.get("mode") || "studio");
  if (!(file instanceof File)) return Response.json({ error: "Choose a product image to enhance." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "AI Product Studio accepts JPG, PNG, WebP or AVIF images only." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Images must be 15 MB or smaller." }, { status: 400 });

  const prompt = [
    "Edit this product photograph for a trustworthy premium ecommerce catalogue.",
    MODE_PROMPTS[mode] || MODE_PROMPTS.studio,
    "Preserve the exact product identity, geometry, colour, material, branding, labels and visible accessories.",
    "Do not invent features, alter text or logos, change the quantity, add accessories, or make performance claims.",
    "The finished image must remain an honest representation of the item a customer will receive.",
  ].join(" ");

  const outbound = new FormData();
  outbound.set("model", setting("OPENAI_IMAGE_MODEL") || "gpt-image-2");
  outbound.set("prompt", prompt);
  outbound.set("image", file, file.name);
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: outbound,
  });
  const payload = await response.json() as { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } };
  if (!response.ok) return Response.json({ error: payload.error?.message || "The AI image service could not enhance this photo." }, { status: response.status });

  const result = payload.data?.[0];
  let bytes: Uint8Array;
  let contentType = "image/png";
  if (result?.b64_json) bytes = decodeBase64(result.b64_json);
  else if (result?.url) {
    const download = await fetch(result.url);
    if (!download.ok) return Response.json({ error: "The enhanced image could not be downloaded." }, { status: 502 });
    bytes = new Uint8Array(await download.arrayBuffer());
    contentType = download.headers.get("content-type") || contentType;
  } else return Response.json({ error: "The AI image service returned no image." }, { status: 502 });

  const extension = contentType.includes("webp") ? "webp" : contentType.includes("jpeg") ? "jpg" : "png";
  const key = `products/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-ai.${extension}`;
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" } });
  return Response.json({ url: `/api/media/${key}`, provider: "openai", model: setting("OPENAI_IMAGE_MODEL") || "gpt-image-2" });
}
