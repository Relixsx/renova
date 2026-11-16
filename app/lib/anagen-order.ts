import { getAllStates } from "ng-geo-data";
import { ANAGEN } from "./anagen-offer.mjs";
import { CHECKOUT_WHATSAPP_NOTICE_VERSION, checkoutWhatsAppConsent } from "./checkout-whatsapp";
import { phoneForWhatsApp } from "./whatsapp-message";

export class AnagenOrderError extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message); }
}

function text(input: unknown, label: string, max: number, required = true) {
  if (typeof input !== "string") {
    if (!required && (input === undefined || input === null)) return "";
    throw new AnagenOrderError(`Enter your ${label}.`);
  }
  const value = input.trim();
  if ((required && !value) || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new AnagenOrderError(`Check your ${label}.`);
  }
  return value;
}

function phone(input: unknown, label: string, optional = false) {
  const value = text(input, label, 32, !optional);
  if (!value) return "";
  try { return phoneForWhatsApp(value); }
  catch { throw new AnagenOrderError(`Enter a valid ${label}.`); }
}

export async function digestAnagenValue(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function validateAnagenOrder(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AnagenOrderError("Check your order details.");
  const payload = input as Record<string, unknown>;
  if (payload.website) throw new AnagenOrderError("Your order could not be submitted.");
  if (payload.offerVersion !== ANAGEN.version) throw new AnagenOrderError("Refresh this page to review the current Anagen offer.", 409);
  if (payload.customerConfirmedDeliveryCommitment !== true) throw new AnagenOrderError("Confirm that you intend to receive and pay for this order.");
  const key = text(payload.idempotencyKey, "order reference", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new AnagenOrderError("Refresh the page and try your order again.");
  const bundle = ANAGEN.bundles.find((item) => item.packs === payload.quantity);
  if (!bundle) throw new AnagenOrderError("Choose 1, 2 or 3 packs.");
  const raw = payload.details;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AnagenOrderError("Complete your delivery details.");
  const fields = raw as Record<string, unknown>;
  const email = text(fields.email, "email address", 254, false).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AnagenOrderError("Check your email address, or leave it blank.");
  const stateCode = text(fields.stateCode, "state", 2).toUpperCase();
  const state = getAllStates().find((item) => item.code === stateCode);
  if (!state) throw new AnagenOrderError("Select your delivery state.");
  const availabilityDay = text(fields.availabilityDay, "delivery availability", 8);
  if (!["Today", "Tomorrow"].includes(availabilityDay)) throw new AnagenOrderError("Choose when you will be available to receive the order.");
  const details = {
    fullName: text(fields.fullName, "full name", 120), email,
    phone: phone(fields.phone, "delivery phone number"),
    whatsappPhone: phone(fields.whatsappPhone, "WhatsApp number"),
    alternativePhone: phone(fields.alternativePhone, "alternative phone number", true),
    streetAddress: text(fields.streetAddress, "delivery address", 600),
    cityTown: text(fields.cityTown, "city or town", 100),
    stateCode, state: state.name, lga: text(fields.lga, "local government area", 100, false),
    availabilityDay, orderSource: ANAGEN.version,
  };
  let consent;
  try {
    consent = checkoutWhatsAppConsent(undefined, details.phone, { phone: details.whatsappPhone, noticeVersion: payload.whatsappNoticeVersion });
  } catch { throw new AnagenOrderError("Review the WhatsApp order update notice and enter your WhatsApp number."); }
  if (payload.whatsappNoticeVersion !== CHECKOUT_WHATSAPP_NOTICE_VERSION) throw new AnagenOrderError("Refresh the page to review your order update details.", 409);
  return { key: key.toLowerCase(), bundle, details, consent };
}
