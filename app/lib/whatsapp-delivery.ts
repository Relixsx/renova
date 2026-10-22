export type WhatsAppSettings = {
  enabled: boolean; token: string; phoneId: string; template: string; language: string; version: string;
};
export type QueuedWhatsApp = {
  id: number; status: string; attempts: number; nextAttemptAt: string;
  eligible: boolean; reason?: string; deferUntil?: string;
  to: string; parameters: [string, string, string, string];
};
export type DeliveryPatch = {
  status: string; errorMessage: string | null; nextAttemptAt?: string;
  providerMessageId?: string; acceptedAt?: string;
  attempts?: number;
};
export interface WhatsAppDeliveryStore {
  load(id: number): Promise<QueuedWhatsApp | null>;
  claim(id: number, now: string): Promise<boolean>;
  finish(id: number, patch: DeliveryPatch, now: string): Promise<void>;
}

export function whatsappSettings(env: Record<string, string | undefined> = process.env): WhatsAppSettings {
  const value = (key: string) => env[key]?.trim() || "";
  return {
    enabled: value("WHATSAPP_AUTOMATION_ENABLED") === "true",
    token: value("WHATSAPP_ACCESS_TOKEN"), phoneId: value("WHATSAPP_PHONE_NUMBER_ID"),
    template: value("WHATSAPP_REMINDER_TEMPLATE") || "renova_delivery_update",
    language: value("WHATSAPP_TEMPLATE_LANGUAGE") || "en", version: value("WHATSAPP_GRAPH_API_VERSION") || "v25.0",
  };
}

export function whatsappConfigured(settings: WhatsAppSettings) {
  return settings.enabled && Boolean(settings.token && /^\d+$/.test(settings.phoneId)
    && /^[a-z][a-z0-9_]+$/.test(settings.template) && /^v\d+\.0$/.test(settings.version));
}

export async function deliverQueuedWhatsApp(
  store: WhatsAppDeliveryStore, id: number, settings: WhatsAppSettings,
  fetcher: typeof fetch = fetch, now = new Date(),
) {
  const queued = await store.load(id);
  if (!queued || queued.status !== "pending") return { status: queued?.status || "skipped" };
  if (!whatsappConfigured(settings)) return { status: "pending", error: "WhatsApp automation is paused or its credentials are incomplete." };
  if (new Date(queued.nextAttemptAt).getTime() > now.getTime()) return { status: "pending" };
  if (!await store.claim(id, now.toISOString())) return { status: "pending" };
  // Re-read after the atomic claim so a just-received opt-out or terminal status
  // is respected before calling Meta. A request already in flight cannot be recalled.
  const message = await store.load(id);
  let patch: DeliveryPatch;
  let calledProvider = false;
  if (!message?.eligible) {
    patch = { status: "cancelled", errorMessage: message?.reason || "Order is no longer eligible for WhatsApp." };
  } else if (message.deferUntil) {
    patch = { status: "pending", nextAttemptAt: message.deferUntil, errorMessage: "Waiting for the confirmation or next 24-hour update." };
  } else {
    try {
      calledProvider = true;
      const response = await fetcher(`https://graph.facebook.com/${settings.version}/${settings.phoneId}/messages`, {
        method: "POST", headers: { authorization: `Bearer ${settings.token}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ messaging_product: "whatsapp", to: message.to, type: "template", template: {
          name: settings.template, language: { code: settings.language },
          components: [{ type: "body", parameters: message.parameters.map((text) => ({ type: "text", text })) }],
        } }),
      });
      const payload = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { code?: number; is_transient?: boolean } };
      const messageId = payload.messages?.[0]?.id;
      if (response.ok && typeof messageId === "string" && messageId.startsWith("wamid.")) {
        patch = { status: "accepted", providerMessageId: messageId, acceptedAt: new Date().toISOString(), errorMessage: null };
      } else if (!response.ok && payload.error && response.status < 500) {
        const retry = (response.status === 429 || payload.error.is_transient === true) && message.attempts < 5;
        patch = { status: retry ? "pending" : "failed", errorMessage: `Meta rejected the message (HTTP ${response.status}, code ${payload.error.code ?? "unknown"}). Check the token, template, recipient and WhatsApp Manager.`,
          ...(retry ? { nextAttemptAt: new Date(now.getTime() + Math.min(60, 2 ** message.attempts) * 60_000).toISOString() } : {}) };
      } else {
        patch = { status: "uncertain", errorMessage: "Meta did not return a definite result. Check WhatsApp Manager before retrying; automatic retries are paused to avoid a duplicate." };
      }
    } catch {
      // A timeout can happen after Meta accepted the POST. It is unsafe to
      // blindly retry without an idempotency guarantee from the provider.
      patch = { status: "uncertain", errorMessage: "The connection ended without a definite result. Check WhatsApp Manager before retrying." };
    }
  }
  if (!calledProvider && message) patch.attempts = Math.max(0, message.attempts - 1);
  await store.finish(id, patch, new Date().toISOString());
  return { status: patch.status, error: patch.errorMessage ?? undefined, providerMessageId: patch.providerMessageId };
}
