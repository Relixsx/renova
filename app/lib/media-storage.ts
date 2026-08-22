function configured(name: string) {
  return process.env[name]?.trim();
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function uploadMedia(file: Blob, fileName: string, options?: { suffix?: string }) {
  const cloudName = configured("CLOUDINARY_CLOUD_NAME");
  const apiKey = configured("CLOUDINARY_API_KEY");
  const apiSecret = configured("CLOUDINARY_API_SECRET");
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Media storage is not configured. Add the three CLOUDINARY_* environment variables.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "renova/products";
  const signatureInput = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = hex(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(signatureInput)));
  const data = new FormData();
  data.set("file", file, fileName);
  data.set("api_key", apiKey);
  data.set("timestamp", String(timestamp));
  data.set("folder", folder);
  data.set("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`, { method: "POST", body: data });
  const payload = await response.json() as { secure_url?: string; public_id?: string; bytes?: number; error?: { message?: string } };
  if (!response.ok || !payload.secure_url) throw new Error(payload.error?.message || "Cloudinary could not store the media file.");
  return { key: payload.public_id || "", url: payload.secure_url, size: payload.bytes ?? file.size, name: fileName, suffix: options?.suffix };
}
