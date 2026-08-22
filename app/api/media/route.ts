import { requireOwnerRequest } from "../../lib/admin-auth";
import { uploadMedia } from "../../lib/media-storage";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/webm"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose an image or video to upload." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "Use JPG, PNG, WebP, AVIF, MP4 or WebM files." }, { status: 400 });
  const maximum = file.type.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maximum) return Response.json({ error: file.type.startsWith("video/") ? "Videos must be 50 MB or smaller." : "Images must be 15 MB or smaller." }, { status: 400 });

  try {
    return Response.json(await uploadMedia(file, file.name));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Media upload failed." }, { status: 503 });
  }
}
