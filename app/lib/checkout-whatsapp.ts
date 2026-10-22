import { phoneForWhatsApp } from "./whatsapp-message";

// Increment when the checkout request/disclosure changes. Old, explicitly
// consented orders keep their original source and continue to work.
export const CHECKOUT_WHATSAPP_NOTICE_VERSION = "checkout-v2";
export const CHECKOUT_WHATSAPP_SOURCES = ["checkout-v1", CHECKOUT_WHATSAPP_NOTICE_VERSION];

export function checkoutWhatsAppConsent(legacyOptIn: unknown, deliveryPhone: string, request?: unknown) {
  if (request !== undefined) {
    const details = request as { phone?: unknown; noticeVersion?: unknown } | null;
    if (!details || details.noticeVersion !== CHECKOUT_WHATSAPP_NOTICE_VERSION || typeof details.phone !== "string") {
      throw new Error("Review the WhatsApp order update details and enter your WhatsApp phone number.");
    }
    return { whatsappPhone: phoneForWhatsApp(details.phone), whatsappConsentAt: new Date().toISOString(), whatsappConsentSource: CHECKOUT_WHATSAPP_NOTICE_VERSION };
  }
  // Cached older checkout pages must still require their explicit checkbox.
  return legacyOptIn === true
    ? { whatsappPhone: phoneForWhatsApp(deliveryPhone), whatsappConsentAt: new Date().toISOString(), whatsappConsentSource: "checkout-v1" }
    : {};
}
