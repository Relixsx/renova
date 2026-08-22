"use client";

import { SUPPORT_EMAIL } from "../lib/site";

export function ProductDeliveryCard({ available }: { available: boolean }) {
  return <aside className="product-delivery-card" aria-label="Delivery and purchase support">
    <div><span aria-hidden="true">↗</span><p><b>{available ? "Estimated delivery: 3–5 working days" : "Currently unavailable"}</b><small>{available ? "Your exact carrier and any applicable charge are confirmed before payment." : "This item cannot be added to a paid order until it is available again."}</small></p></div>
    <div><span aria-hidden="true">✓</span><p><b>Secure prepaid checkout</b><small>Payment is completed on Paystack and verified by Renova’s server.</small></p></div>
    <div><span aria-hidden="true">↺</span><p><b>Seven-day return request window</b><small>Eligibility and item-condition requirements are explained in the published returns policy.</small></p></div>
    <div><span aria-hidden="true">?</span><p><b>Need a product answer?</b><small>Use Ask Renova or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</small></p></div>
  </aside>;
}
