import { phoneForWhatsApp } from "./whatsapp-message";

// Increment when the checkout request/disclosure changes. Old, explicitly
// consented orders keep their original source and continue to work.
export const CHECKOUT_WHATSAPP_NOTICE_VERSION = "checkout-v3";
const SUPPORTED_CHECKOUT_NOTICES = ["checkout-v2", CHECKOUT_WHATSAPP_NOTICE_VERSION];
export const CHECKOUT_WHATSAPP_SOURCES = ["checkout-v1", ...SUPPORTED_CHECKOUT_NOTICES];

export function checkoutWhatsAppConsent(legacyOptIn: unknown, deliveryPhone: string, request?: unknown) {
  if (request !== undefined) {
    const details = request as { phone?: unknown; noticeVersion?: unknown } | null;
    if (!details || typeof details.noticeVersion !== "string" || !SUPPORTED_CHECKOUT_NOTICES.includes(details.noticeVersion) || typeof details.phone !== "string") {
      throw new Error("Review the WhatsApp order update details and enter your WhatsApp phone number.");
    }
    // Keep an in-progress checkout using the previous notice working, and
    // record the version actually shown rather than relabelling its agreement.
    return { whatsappPhone: phoneForWhatsApp(details.phone), whatsappConsentAt: new Date().toISOString(), whatsappConsentSource: details.noticeVersion };
  }
  // Cached older checkout pages must still require their explicit checkbox.
  return legacyOptIn === true
    ? { whatsappPhone: phoneForWhatsApp(deliveryPhone), whatsappConsentAt: new Date().toISOString(), whatsappConsentSource: "checkout-v1" }
    : {};
}
