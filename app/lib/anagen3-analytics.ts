"use client";

import { ANAGEN } from "./anagen-offer.mjs";
import { readAnagenCampaign } from "./anagen-campaign";
import { trackMetaEvent, type MetaEventName } from "./meta-pixel";

type FunnelEvent = "AnagenPackageSelected" | "AnagenOrderFormReached" | "AnagenOrderValidationError";
type FunnelParameters = { num_items?: number; value?: number; field?: string; reason?: string };

let pageEventKey: string | undefined;
let interactionSequence = 0;

function eventKey(stage: string) {
  pageEventKey ||= window.crypto.randomUUID();
  return `anagen3-${pageEventKey}-${stage}`;
}

export function trackAnagen3(event: FunnelEvent, options: FunnelParameters = {}, once = false) {
  if (!window.fbq) return;
  const eventID = eventKey(once ? event : `${event}-${++interactionSequence}`);
  window.fbq("trackCustom", event, { funnel: "anagen3", content_ids: [ANAGEN.slug], currency: "NGN", ...options }, { eventID });
}

export function trackAnagen3Meta(event: MetaEventName, packs: number, totalKobo: number, orderNumber?: string) {
  return trackMetaEvent(event, {
    funnel: "anagen3",
    content_ids: [ANAGEN.slug],
    content_name: ANAGEN.name,
    content_type: "product",
    currency: "NGN",
    num_items: packs,
    value: totalKobo / 100,
    ...(orderNumber ? { order_id: orderNumber, payment_method: "cash_on_delivery" } : {}),
  }, orderNumber || eventKey(event === "InitiateCheckout" ? `${event}-${++interactionSequence}` : event));
}

export function currentAnagenCampaign() {
  return readAnagenCampaign(Object.fromEntries(new URLSearchParams(window.location.search)));
}
