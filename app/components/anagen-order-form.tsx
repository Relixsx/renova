"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AnagenState } from "../lib/anagen-states";
import { reportAnagenDiagnostic } from "../lib/anagen-diagnostics";
import { ANAGEN } from "../lib/anagen-offer.mjs";
import { browserUuid } from "../lib/browser-uuid";
import { CHECKOUT_WHATSAPP_NOTICE_VERSION } from "../lib/checkout-whatsapp";
import { trackMetaEvent } from "../lib/meta-pixel";
import { currentAnagenCampaign, trackAnagen3, trackAnagen3Meta } from "../lib/anagen3-analytics";
import styles from "../anagen/anagen.module.css";

const keyName = "renova-anagen-pending-order";
const money = (amount: number) => `₦${(amount / 100).toLocaleString("en-NG")}`;
type ReceivedOrder = { orderNumber: string; totalKobo: number; packs: number; alreadyReceived?: boolean };

type AnagenFunnel = "anagen3";

export function AnagenBundleLink({ packs, className, children, funnel, ariaLabel }: {
  packs: number; className: string; children: ReactNode; funnel?: AnagenFunnel; ariaLabel?: string;
}) {
  return <a className={className} href="#order-form" aria-label={ariaLabel} onClick={() => {
    window.dispatchEvent(new CustomEvent("renova-anagen-package", { detail: packs }));
    if (funnel) recordPackageSelection(packs);
  }}>{children}</a>;
}

function recordPackageSelection(packs: number) {
  const offer = ANAGEN.bundles.find((item) => item.packs === packs);
  if (!offer) return;
  try { trackAnagen3("AnagenPackageSelected", { num_items: packs, value: offer.totalKobo / 100 }); } catch { /* Analytics is optional. */ }
}

export function AnagenOrderForm({ stock, supportPhone, funnel, states }: {
  stock?: number | null; supportPhone: string; funnel?: AnagenFunnel; states: AnagenState[];
}) {
  const [quantity, setQuantity] = useState(1);
  const [stateCode, setStateCode] = useState("");
  const [lgaOptions, setLgaOptions] = useState<{ code: string; areas: { name: string }[] }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [referenceUsed, setReferenceUsed] = useState(false);
  const [received, setReceived] = useState<ReceivedOrder | null>(null);
  const submission = useRef(false);
  const pendingKey = useRef("");
  const initiated = useRef(false);
  const invalidReported = useRef(false);
  const completion = useRef<HTMLElement>(null);
  const deliveryPhone = useRef<HTMLInputElement>(null);
  const whatsappPhone = useRef<HTMLInputElement>(null);
  const bundle = ANAGEN.bundles.find((item) => item.packs === quantity)!;
  // The public landing page does not query/poll Neon for each visitor.
  // The order endpoint always verifies current catalogue availability.
  const available = stock === undefined || (stock !== null && stock >= quantity);
  const localGovernments = lgaOptions?.code === stateCode ? lgaOptions.areas : [];

  useEffect(() => {
    if (!stateCode) return;
    let current = true;
    import("ng-geo-data").then(({ getLGAsByState }) => {
      if (current) setLgaOptions({ code: stateCode, areas: getLGAsByState(stateCode) });
    }).catch(() => {
      // The full address can still be used when optional LGA choices fail to load.
      if (current) setLgaOptions({ code: stateCode, areas: [] });
    });
    return () => { current = false; };
  }, [stateCode]);

  useEffect(() => {
    const selectPackage = (event: Event) => {
      const packs = (event as CustomEvent<number>).detail;
      if (funnel && (submission.current || received || stock === null || (typeof stock === "number" && stock < packs))) return;
      if (ANAGEN.bundles.some((offer) => offer.packs === packs)) { setQuantity(packs); setReceived(null); }
    };
    window.addEventListener("renova-anagen-package", selectPackage);
    return () => window.removeEventListener("renova-anagen-package", selectPackage);
  }, [funnel, received, stock]);

  useEffect(() => {
    if (received) {
      completion.current?.focus();
      completion.current?.scrollIntoView?.({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }
  }, [received]);

  function beginCheckout() {
    if (initiated.current) return;
    initiated.current = true;
    try {
      if (funnel) trackAnagen3Meta("InitiateCheckout", quantity, bundle.totalKobo);
      else trackMetaEvent("InitiateCheckout", { content_ids: [ANAGEN.slug], content_name: ANAGEN.name, content_type: "product", value: bundle.totalKobo / 100, currency: "NGN", num_items: quantity });
    } catch { /* Analytics cannot prevent an order. */ }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submission.current || !available) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    submission.current = true; setBusy(true); setError(""); setReferenceUsed(false);
    const fields = new FormData(form);
    let timeout: number | undefined;
    try {
      const controller = typeof AbortController === "function" ? new AbortController() : undefined;
      if (controller) timeout = window.setTimeout(() => controller.abort(), 30_000);
      if (!pendingKey.current) {
        try { pendingKey.current = sessionStorage.getItem(keyName) || ""; } catch { /* Private storage may be unavailable. */ }
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pendingKey.current)) pendingKey.current = browserUuid();
        try { sessionStorage.setItem(keyName, pendingKey.current); } catch { /* In-memory retry protection still works. */ }
      }
      const response = await fetch("/api/anagen/order", {
        method: "POST", headers: { "content-type": "application/json" }, signal: controller?.signal,
        body: JSON.stringify({
          offerVersion: ANAGEN.version, idempotencyKey: pendingKey.current, quantity,
          ...(funnel ? { funnel, campaign: currentAnagenCampaign() } : {}),
          customerConfirmedDeliveryCommitment: fields.get("commitment") === "yes",
          whatsappNoticeVersion: CHECKOUT_WHATSAPP_NOTICE_VERSION, website: fields.get("website"),
          details: Object.fromEntries(["fullName", "phone", "whatsappPhone", "email", "streetAddress", "stateCode", "lga", "availabilityDay"].map((name) => [name, String(fields.get(name) ?? "")])),
        }),
      });
      const payload = await response.json() as ReceivedOrder & { error?: string; code?: string };
      if (payload.code === "REFERENCE_USED") setReferenceUsed(true);
      if (!response.ok || !payload.orderNumber || !Number.isInteger(payload.totalKobo)) {
        if (funnel) reportAnagenDiagnostic("order-rejected");
        if (funnel && [400, 409, 413].includes(response.status)) {
          try { trackAnagen3("AnagenOrderValidationError", { reason: payload.code === "REFERENCE_USED" ? "duplicate_reference" : response.status === 409 ? "offer_or_stock" : "invalid_input" }); } catch { /* Analytics is optional. */ }
        }
        throw new Error(payload.error || "We could not confirm the order. Please retry with the same details.");
      }
      try {
        if (funnel) {
          if (response.status === 201 && payload.alreadyReceived === false) trackAnagen3Meta("Purchase", payload.packs, payload.totalKobo, payload.orderNumber);
        } else if (!payload.alreadyReceived) trackMetaEvent("Purchase", { content_ids: [ANAGEN.slug], content_name: ANAGEN.name, content_type: "product", value: payload.totalKobo / 100, currency: "NGN", num_items: payload.packs, order_id: payload.orderNumber, payment_method: "cash_on_delivery" }, payload.orderNumber);
      } catch { /* A recorded order must not be retried because analytics failed. */ }
      try { sessionStorage.removeItem(keyName); } catch { /* No customer details are stored here. */ }
      pendingKey.current = ""; form.reset(); setQuantity(1); setStateCode(""); setReceived(payload);
      window.dispatchEvent(new CustomEvent("renova-anagen-completed"));
    } catch (reason) {
      if (funnel) reportAnagenDiagnostic("checkout-error");
      setError(reason instanceof Error ? reason.message : "The connection was interrupted. Retry with the same details; your reference prevents duplicate orders.");
    } finally { window.clearTimeout(timeout); submission.current = false; setBusy(false); }
  }

  if (received) return <section id="anagen-order-confirmed" ref={completion} className={styles.success} data-anagen-funnel={funnel} tabIndex={-1} aria-live="polite">
    <span className={styles.successMark} aria-hidden="true">✓</span>
    <p className={styles.eyebrow}>{funnel ? "Order received" : "Renova order confirmed"}</p>
    <h2>Thank you. Your Anagen order is in.</h2>
    <p>{received.packs} {received.packs === 1 ? "pack" : "packs"} · <strong>{money(received.totalKobo)}</strong> payable on delivery. Doorstep delivery is free.</p>
    <div className={styles.reference} data-order-reference={funnel}><span>Your order number</span><strong>{received.orderNumber}</strong></div>
    <p>{funnel ? "Keep your phone available. Renova will contact you to confirm delivery and send order updates to the WhatsApp number you entered." : "Our team will contact you to confirm delivery. Your WhatsApp confirmation and delivery updates use the number you entered."}</p>
    <p><strong>Estimated delivery: {ANAGEN.estimate}.</strong>{!funnel && " Same-day delivery in state capitals is subject to address and dispatch confirmation."}</p>
    <div className={styles.successActions} data-success-actions={funnel}><Link href={`/track-order?orderNumber=${encodeURIComponent(received.orderNumber)}`} className={styles.button}>Track your order</Link><button type="button" className={styles.secondaryButton} onClick={() => { setReceived(null); setError(""); initiated.current = false; window.dispatchEvent(new CustomEvent("renova-anagen-package", { detail: 1 })); }}>Place another order</button></div>
  </section>;

  return <div className={styles.orderCard} data-anagen-funnel={funnel}>
    <header className={styles.sectionIntro}>{!funnel && <p className={styles.eyebrow}>Your Anagen, on its way</p>}<h2>Where should we deliver?</h2><p>{funnel ? "Enter the details Renova should use to confirm your delivery." : "Free doorstep delivery. Pay only when your order arrives."}</p></header>
    {stock === null ? <p className={styles.formNotice} role="status">Ordering is temporarily unavailable. Please contact Renova for help.</p> : typeof stock === "number" && stock < 1 ? <p className={styles.formNotice} role="status">Anagen is currently unavailable. Please check back or contact Renova.</p> : null}
    <form onSubmit={submit} onFocus={beginCheckout} className={styles.form} onInvalid={funnel ? (event) => {
      if (invalidReported.current) return;
      invalidReported.current = true;
      requestAnimationFrame(() => { invalidReported.current = false; });
      const field = (event.target as HTMLInputElement).name;
      const checkoutFields = ["fullName", "phone", "whatsappPhone", "email", "streetAddress", "stateCode", "lga", "availabilityDay", "commitment"];
      if (checkoutFields.includes(field)) {
        try { trackAnagen3("AnagenOrderValidationError", { field, reason: "invalid_input" }); } catch { /* Analytics is optional. */ }
      }
    } : undefined}>
      <fieldset disabled={busy || stock === null || (typeof stock === "number" && stock < 1)}>
        <label htmlFor="anagen-full-name">Full name <span>*</span><input id="anagen-full-name" name="fullName" autoComplete="name" required maxLength={120} placeholder="Your full name" /></label>
        <div className={styles.twoColumns}>
          <label htmlFor="anagen-phone">Delivery phone number <span>*</span><input ref={deliveryPhone} id="anagen-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={32} placeholder="08012345678" /></label>
          <label htmlFor="anagen-whatsapp">WhatsApp phone number <span>*</span><input ref={whatsappPhone} id="anagen-whatsapp" name="whatsappPhone" type="tel" inputMode="tel" autoComplete="section-whatsapp tel" required maxLength={32} placeholder="Your WhatsApp number" aria-describedby="anagen-whatsapp-help" /></label>
        </div>
        <div className={styles.phoneHelp}><p id="anagen-whatsapp-help" className={styles.fieldHint}>Order confirmation and updates go to this WhatsApp number.</p><button className={styles.copyPhone} data-phone-shortcut={funnel} type="button" onClick={() => {
          if (!deliveryPhone.current || !whatsappPhone.current) return;
          const number = deliveryPhone.current.value.trim();
          if (!number) { deliveryPhone.current.focus(); return; }
          whatsappPhone.current.value = number;
          whatsappPhone.current.focus();
        }}>{funnel ? "Use my delivery number for WhatsApp" : "Use delivery number"}</button></div>
        <label htmlFor="anagen-email">Email address <small>Optional</small><input id="anagen-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" /></label>
        <label htmlFor="anagen-address">Full delivery address <span>*</span><textarea id="anagen-address" name="streetAddress" autoComplete="street-address" required maxLength={600} rows={3} placeholder="House number, street, area or city, and a nearby landmark" aria-describedby="anagen-address-help" /></label>
        <p id="anagen-address-help" className={styles.fieldHint}>Include your town or city here so our delivery team can find you.</p>
        <div className={styles.twoColumns}>
          <label htmlFor="anagen-state">State <span>*</span><select id="anagen-state" name="stateCode" autoComplete="address-level1" required value={stateCode} onChange={(event) => setStateCode(event.target.value)}><option value="">Select your state</option>{states.map((state) => <option key={state.code} value={state.code}>{state.code === "FC" ? "FCT — Abuja" : state.name}</option>)}</select></label>
          <label htmlFor="anagen-lga">Local government area <small>Optional</small><select id="anagen-lga" name="lga" key={stateCode} defaultValue="" disabled={!stateCode}><option value="">{!stateCode ? "Select your state first" : lgaOptions?.code === stateCode ? "Leave blank if you’re not sure" : "Loading local government areas…"}</option>{localGovernments.map((area) => <option key={area.name} value={area.name}>{area.name}</option>)}</select></label>
        </div>
        <label htmlFor="anagen-quantity">Choose your package <span>*</span><select id="anagen-quantity" name="quantity" value={quantity} onChange={(event) => {
          const packs = Number(event.target.value);
          setQuantity(packs);
          if (funnel) recordPackageSelection(packs);
          window.dispatchEvent(new CustomEvent("renova-anagen-package", { detail: packs }));
        }}>{ANAGEN.bundles.map((offer) => <option key={offer.packs} value={offer.packs} disabled={typeof stock === "number" && stock < offer.packs}>{offer.label} — {money(offer.totalKobo)}{offer.savingKobo ? ` (save ${money(offer.savingKobo)})` : ""}</option>)}</select></label>
        <fieldset className={styles.availability} data-availability={funnel}><legend>When will you be available to receive it? <span>*</span></legend><div><label><input type="radio" name="availabilityDay" value="Today" required /><span>Today</span></label><label><input type="radio" name="availabilityDay" value="Tomorrow" required /><span>Tomorrow</span></label></div></fieldset>
        <p className={styles.fieldHint}>Your availability helps us arrange delivery. Our team will confirm your delivery time.</p>
        <div className={styles.orderTotal} data-order-total={funnel} aria-live={funnel ? "polite" : undefined}><span>{bundle.label} of Anagen <small>{quantity * 2} sachets + application guide</small></span><strong>{money(bundle.totalKobo)}</strong><span>Doorstep delivery</span><b>FREE</b><span className={styles.totalLabel}>Pay on delivery</span><strong>{money(bundle.totalKobo)}</strong></div>
        <label className={styles.agreement} htmlFor="anagen-commitment"><input id="anagen-commitment" name="commitment" type="checkbox" value="yes" required /><span>I confirm that I intend to receive this order and pay {money(bundle.totalKobo)} on delivery.</span></label>
        <p className={styles.updatesNotice}>By placing this order, you request an order confirmation and daily delivery updates on WhatsApp at the number above. <Link href="/privacy">Privacy policy</Link>.</p>
        <div className={styles.honeypot} aria-hidden="true"><label htmlFor="anagen-website">Website<input id="anagen-website" name="website" tabIndex={-1} autoComplete="off" /></label></div>
        {funnel && typeof stock === "number" && stock > 0 && stock < quantity && <p className={styles.formNotice} role="status">This package is currently unavailable. Choose an available package.</p>}
        {error && <p className={styles.formError} role="alert">{error}</p>}
        {referenceUsed && <button className={styles.secondaryButton} type="button" onClick={() => {
          pendingKey.current = "";
          try { sessionStorage.removeItem(keyName); } catch { /* In-memory key is cleared too. */ }
          setReferenceUsed(false); setError("");
        }}>Create a separate new order</button>}
        <button className={styles.submitButton} disabled={busy || !available} type="submit">{busy ? "Confirming your order…" : funnel ? "Place my order — pay on delivery" : `Place order — ${money(bundle.totalKobo)} on delivery`}</button>
        <p className={styles.secureNote}>No payment is collected now. Fields marked * are required.</p>
      </fieldset>
    </form>
    <div className={styles.support} data-order-support={funnel}><p>Have a question before ordering?</p>{supportPhone ? <a className={styles.secondaryButton} href={`https://wa.me/${supportPhone}?text=${encodeURIComponent("Hello Renova, I have a question about Anagen.")}`} target="_blank" rel="noopener noreferrer">Chat with Renova on WhatsApp ↗</a> : <a className={styles.secondaryButton} href="mailto:support@shoprenova.com.ng">Contact Renova support</a>}</div>
  </div>;
}
