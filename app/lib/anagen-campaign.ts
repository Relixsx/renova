const campaignKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
type CampaignKey = typeof campaignKeys[number];

export function readAnagenCampaign(input: unknown): Partial<Record<CampaignKey, string>> {
  if (typeof input !== "object" || !input || Array.isArray(input)) return {};
  const record = input as Record<string, unknown>;
  const campaign: Partial<Record<CampaignKey, string>> = {};
  for (const key of campaignKeys) {
    const value = record[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (/^[a-z0-9][a-z0-9 _./-]{0,79}$/i.test(trimmed)) campaign[key] = trimmed;
  }
  return campaign;
}

export function anagenCampaignSource(request: Request, funnel: "anagen3" | undefined) {
  if (funnel) return funnel;
  const referer = request.headers.get("referer");
  if (!referer) return undefined;
  try {
    const page = new URL(referer);
    const origin = request.headers.get("origin") || new URL(request.url).origin;
    if (page.origin !== origin) return undefined;
    if (page.pathname === "/anagen") return "anagen";
    if (page.pathname === "/anagen2") return "anagen2";
  } catch { /* Unrecognized sources stay unassigned. */ }
}
