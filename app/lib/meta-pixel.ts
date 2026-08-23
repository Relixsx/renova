"use client";

export type MetaEventName = "ViewContent" | "AddToCart" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase";

export type MetaEventParameters = {
  content_ids?: string[];
  content_name?: string;
  content_type?: "product";
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  currency?: "NGN";
  value?: number;
  num_items?: number;
  order_id?: string;
};

export function trackMetaEvent(event: MetaEventName, parameters: MetaEventParameters, eventId?: string) {
  if (typeof window === "undefined" || !window.fbq) return false;
  if (eventId) window.fbq("track", event, parameters, { eventID: eventId });
  else window.fbq("track", event, parameters);
  return true;
}

export function onMetaPixelReady(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  if (window.fbq) callback();
  const listener = () => callback();
  window.addEventListener("renova-meta-ready", listener);
  return () => window.removeEventListener("renova-meta-ready", listener);
}
