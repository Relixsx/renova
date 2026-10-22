export async function equalSecret(left: string, right: string) {
  const hash = (value: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [a, b] = await Promise.all([hash(left), hash(right)]);
  let difference = 0;
  const aa = new Uint8Array(a), bb = new Uint8Array(b);
  for (let i = 0; i < aa.length; i++) difference |= aa[i] ^ bb[i];
  return difference === 0;
}

export async function verifyWhatsAppSignature(body: Uint8Array<ArrayBuffer>, signature: string, appSecret: string) {
  if (!appSecret || !/^sha256=[a-f\d]{64}$/i.test(signature)) return false;
  const bytes = new Uint8Array(signature.slice(7).match(/../g)!.map((byte) => parseInt(byte, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, bytes, body);
}

export async function limitedWebhookBody(request: Request, limit = 256 * 1024) {
  if (Number(request.headers.get("content-length")) > limit) throw new Error("too-large");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new Error("too-large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return body;
}
