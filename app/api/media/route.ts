import { env } from "cloudflare:workers";
import { requireOwnerRequest } from "../../lib/admin-auth";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/webm"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const denied = requireOwnerRequest(request);
  if (denied) return denied;
  if (!env.BUCKET) return Response.json({ error: "Media storage is not configured." }, { status: 503 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose an image or video to upload." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "Use JPG, PNG, WebP, AVIF, MP4 or WebM files." }, { status: 400 });
  const maximum = file.type.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maximum) return Response.json({ error: file.type.startsWith("video/") ? "Videos must be 50 MB or smaller." : "Images must be 15 MB or smaller." }, { status: 400 });

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const key = `products/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
  return Response.json({ key, url: `/api/media/${key}`, name: file.name, size: file.size });
}
