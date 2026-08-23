import { requireOwnerRequest } from "../../../lib/admin-auth";
import { uploadMedia } from "../../../lib/media-storage";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 15 * 1024 * 1024;

function setting(name: string) {
  return process.env[name]?.trim();
}

function decodeBase64(value: string) {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

const MODE_PROMPTS: Record<string, string> = {
  studio: "Place the product in a clean premium ecommerce studio with a pure white (#FFFFFF) background, balanced soft lighting, a natural contact shadow, accurate white balance and crisp detail.",
  natural: "Improve the lighting and clarity while keeping the original natural setting believable, tidy and premium.",
  background: "Remove the existing background completely and replace it with a uniform pure white (#FFFFFF) ecommerce background with a subtle realistic contact shadow.",
};

export async function POST(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;
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
  try {
    const stored = await uploadMedia(new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: contentType }), `renova-ai-${crypto.randomUUID()}.${extension}`, { suffix: "ai" });
    return Response.json({ ...stored, provider: "openai", model: setting("OPENAI_IMAGE_MODEL") || "gpt-image-2" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The enhanced image could not be stored." }, { status: 503 });
  }
}
