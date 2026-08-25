"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getAllStates, getLGAsByState } from "ng-geo-data";
import { useCart } from "../components/cart-provider";
import { OrderMotionVisual } from "../components/order-motion-visual";
import { formatNaira } from "../lib/catalog";
import { deliveryOptions } from "../lib/checkout";
import { onMetaPixelReady, trackMetaEvent } from "../lib/meta-pixel";

const nigeriaStates = getAllStates();
const whatsappNumber = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(
  /\D/g,
  "",
);

type CheckoutDetails = {
  fullName: string;
  email: string;
  phone: string;
  stateCode: string;
  lga: string;
  cityTown: string;
  streetAddress: string;
  addressLineTwo: string;
  landmark: string;
  deliveryInstructions: string;
};

const initialDetails: CheckoutDetails = {
  fullName: "",
  email: "",
  phone: "",
  stateCode: "LA",
  lga: "Ikeja",
  cityTown: "",
  streetAddress: "",
  addressLineTwo: "",
  landmark: "",
  deliveryInstructions: "",
};

function stateLabel(code: string, name: string) {
  return code === "FC" ? "Federal Capital Territory (Abuja)" : name;
}

export default function CheckoutPage() {
  const { lines, subtotalKobo, clear } = useCart();
  const [step, setStep] = useState(1);
  const [delivery, setDelivery] = useState("jumia");
  const [notice, setNotice] = useState("");
  const [paying, setPaying] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [deliveryConfirmationOpen, setDeliveryConfirmationOpen] =
    useState(false);
  const [details, setDetails] = useState<CheckoutDetails>(initialDetails);
  const localGovernments = useMemo(
    () => getLGAsByState(details.stateCode),
    [details.stateCode],
  );
  const selectedState = nigeriaStates.find(
    (state) => state.code === details.stateCode,
  );
  const selectedDelivery = deliveryOptions.find(
    (option) => option.id === delivery,
  )!;
  const total = subtotalKobo + selectedDelivery.priceKobo;
  const paymentMode = lines[0]?.paymentMode ?? "prepaid";
  const isDeliveryPayment = paymentMode === "cash_on_delivery";
  const checkoutTracked = useRef(false);

  useEffect(
    () =>
      onMetaPixelReady(() => {
        if (checkoutTracked.current || !lines.length) return;
        checkoutTracked.current = true;
        trackMetaEvent("InitiateCheckout", {
          contents: lines.map((line) => ({
            id: line.slug,
            quantity: line.quantity,
            item_price: line.priceKobo / 100,
          })),
          content_ids: lines.map((line) => line.slug),
          content_type: "product",
          value: subtotalKobo / 100,
          currency: "NGN",
          num_items: lines.reduce((sum, line) => sum + line.quantity, 0),
        });
      }),
    [lines, subtotalKobo],
  );

  function updateDetail<K extends keyof CheckoutDetails>(
    field: K,
    value: CheckoutDetails[K],
  ) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  function changeState(stateCode: string) {
    const firstLga = getLGAsByState(stateCode)[0]?.name ?? "";
    setDetails((current) => ({ ...current, stateCode, lga: firstLga }));
  }

  function continueForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep((current) => Math.min(3, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function beginPayment() {
    if (!policyAccepted) {
      setNotice(
        "Accept the delivery, returns and terms policies before continuing.",
      );
      return;
    }
    setPaying(true);
    setNotice("Connecting to secure Paystack checkout…");
    try {
      const response = await fetch("/api/checkout/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((line) => ({
            slug: line.slug,
            quantity: line.quantity,
            variant: line.variant,
          })),
          details,
          deliveryId: delivery,
        }),
      });
      const payload = (await response.json()) as {
        authorizationUrl?: string;
        error?: string;
      };
      if (!response.ok || !payload.authorizationUrl)
        throw new Error(payload.error || "Payment could not be started.");
      trackMetaEvent("AddPaymentInfo", {
        contents: lines.map((line) => ({
          id: line.slug,
          quantity: line.quantity,
          item_price: line.priceKobo / 100,
        })),
        content_ids: lines.map((line) => line.slug),
        content_type: "product",
        value: total / 100,
        currency: "NGN",
        num_items: lines.reduce((sum, line) => sum + line.quantity, 0),
      });
      window.location.href = payload.authorizationUrl;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Payment could not be started.",
      );
      setPaying(false);
    }
  }

  async function placeDeliveryPaymentOrder() {
    if (!policyAccepted) {
      setNotice(
        "Accept the delivery, returns and terms policies before continuing.",
      );
      return;
    }
    setPaying(true);
    setNotice("Confirming your order…");
    try {
      const response = await fetch("/api/checkout/place-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((line) => ({
            slug: line.slug,
            quantity: line.quantity,
            variant: line.variant,
          })),
          details,
          deliveryId: delivery,
          customerConfirmedDeliveryCommitment: true,
        }),
      });
      const payload = (await response.json()) as {
        orderNumber?: string;
        error?: string;
      };
      if (!response.ok || !payload.orderNumber)
        throw new Error(payload.error || "The order could not be placed.");
      trackMetaEvent("Purchase", {
        contents: lines.map((line) => ({
          id: line.slug,
          quantity: line.quantity,
          item_price: line.priceKobo / 100,
        })),
        content_ids: lines.map((line) => line.slug),
        content_type: "product",
        value: total / 100,
        currency: "NGN",
        num_items: lines.reduce((sum, line) => sum + line.quantity, 0),
        payment_method: "cash_on_delivery",
      });
      clear();
      window.location.href = `/order/success/${encodeURIComponent(payload.orderNumber)}`;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The order could not be placed.",
      );
      setPaying(false);
      setDeliveryConfirmationOpen(false);
    }
  }

  if (!lines.length) {
    return (
      <main className="checkout-empty">
        <img src="/renova-mark.svg" alt="" />
        <h1>Your checkout is empty.</h1>
        <p>Add a product before starting checkout.</p>
        <Link href="/shop" className="button primary">
          Return to shop
        </Link>
      </main>
    );
  }

  return (
    <main className="checkout-shell">
      <header className="checkout-header">
        <Link href="/">
          <img src="/renova-mark.svg" alt="" />
          <span>RENOVA</span>
        </Link>
        <b>
          {isDeliveryPayment
            ? "Payment on delivery order"
            : "Secure Paystack checkout"}
        </b>
        <Link href="/cart">← Return to bag</Link>
      </header>
      <div className="checkout-journey">
        <OrderMotionVisual compact />
        <div className="checkout-progress">
          <span className={step >= 1 ? "active" : ""}>
            <b>1</b>Contact & address
          </span>
          <i />
          <span className={step >= 2 ? "active" : ""}>
            <b>2</b>Delivery
          </span>
          <i />
          <span className={step >= 3 ? "active" : ""}>
            <b>3</b>Review & pay
          </span>
        </div>
      </div>
      <div className="checkout-grid">
        <section className="checkout-form-area">
          <div
            className="checkout-trust-strip"
            aria-label="Checkout assurances"
          >
            <article>
              <i aria-hidden="true">↻</i>
              <span>
                <strong>7-day return requests</strong>
                <small>Eligible items, subject to policy conditions</small>
              </span>
            </article>
            <article>
              <i aria-hidden="true">✓</i>
              <span>
                <strong>
                  {isDeliveryPayment ? "Pay on delivery" : "Paystack verified"}
                </strong>
                <small>
                  {isDeliveryPayment
                    ? "Pay only when your order is delivered"
                    : "Payment is confirmed securely by our server"}
                </small>
              </span>
            </article>
          </div>
          {step === 1 && (
            <form onSubmit={continueForm}>
              <span className="eyebrow">Step 1 of 3</span>
              <h1>Where should we send it?</h1>
              <p>
                Enter a complete Nigerian delivery address so your courier can
                find you without delays.
              </p>

              <fieldset className="checkout-fieldset">
                <legend>
                  <span className="fieldset-index">01</span>
                  <span>
                    <b>Contact details</b>
                    <small>
                      We will use these details for payment confirmation and
                      delivery updates.
                    </small>
                  </span>
                </legend>
                <label>
                  Full name
                  <input
                    required
                    autoComplete="name"
                    value={details.fullName}
                    onChange={(event) =>
                      updateDetail("fullName", event.target.value)
                    }
                    placeholder="First name and surname"
                  />
                </label>
                <div className="form-two">
                  <label>
                    Email address
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={details.email}
                      onChange={(event) =>
                        updateDetail("email", event.target.value)
                      }
                      placeholder="you@example.com"
                    />
                  </label>
                  <label>
                    Phone number
                    <input
                      required
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={details.phone}
                      onChange={(event) =>
                        updateDetail("phone", event.target.value)
                      }
                      placeholder="0801 234 5678"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="checkout-fieldset address-fieldset">
                <legend>
                  <span className="fieldset-index">02</span>
                  <span>
                    <b>Delivery address</b>
                    <small>
                      Select your state first. The LGA list updates
                      automatically.
                    </small>
                  </span>
                </legend>
                <div className="form-two">
                  <label>
                    Country / region
                    <input
                      value="Nigeria"
                      readOnly
                      autoComplete="country-name"
                    />
                  </label>
                  <label>
                    State
                    <select
                      required
                      value={details.stateCode}
                      onChange={(event) => changeState(event.target.value)}
                      autoComplete="address-level1"
                    >
                      {nigeriaStates.map((state) => (
                        <option key={state.code} value={state.code}>
                          {stateLabel(state.code, state.name)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="form-two">
                  <label>
                    Local government area
                    <select
                      required
                      value={details.lga}
                      onChange={(event) =>
                        updateDetail("lga", event.target.value)
                      }
                    >
                      {localGovernments.map((lga) => (
                        <option key={lga.name} value={lga.name}>
                          {lga.name}
                        </option>
                      ))}
                    </select>
                    <small className="field-hint">
                      {localGovernments.length} areas available for the selected
                      state
                    </small>
                  </label>
                  <label>
                    City / town
                    <input
                      required
                      autoComplete="address-level2"
                      value={details.cityTown}
                      onChange={(event) =>
                        updateDetail("cityTown", event.target.value)
                      }
                      placeholder="e.g. Ikeja, Ibadan, Gwagwalada"
                    />
                  </label>
                </div>
                <label>
                  Street address
                  <input
                    required
                    autoComplete="address-line1"
                    value={details.streetAddress}
                    onChange={(event) =>
                      updateDetail("streetAddress", event.target.value)
                    }
                    placeholder="House number and street name"
                  />
                </label>
                <div className="form-two">
                  <label>
                    Apartment, suite or estate{" "}
                    <span className="optional-label">Optional</span>
                    <input
                      autoComplete="address-line2"
                      value={details.addressLineTwo}
                      onChange={(event) =>
                        updateDetail("addressLineTwo", event.target.value)
                      }
                      placeholder="Flat, floor, estate or building"
                    />
                  </label>
                  <label>
                    Nearest landmark{" "}
                    <span className="optional-label">Optional</span>
                    <input
                      value={details.landmark}
                      onChange={(event) =>
                        updateDetail("landmark", event.target.value)
                      }
                      placeholder="A well-known place nearby"
                    />
                  </label>
                </div>
                <label>
                  Delivery instructions{" "}
                  <span className="optional-label">Optional</span>
                  <textarea
                    rows={3}
                    value={details.deliveryInstructions}
                    onChange={(event) =>
                      updateDetail("deliveryInstructions", event.target.value)
                    }
                    placeholder="Gate colour, access code, preferred call time or other helpful directions"
                  />
                </label>
              </fieldset>

              <label className="policy-check">
                <input type="checkbox" required />
                <span>
                  I agree that Renova may use these details to process and track
                  my order.
                </span>
              </label>
              <button className="button primary" type="submit">
                Continue to delivery
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={continueForm}>
              <span className="eyebrow">Step 2 of 3</span>
              <h1>Choose your delivery.</h1>
              <p>
                Compare available delivery services and select the option that
                works best for you.
              </p>
              <div className="delivery-options">
                {deliveryOptions.map((option) => (
                  <label
                    className={delivery === option.id ? "selected" : ""}
                    key={option.id}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      value={option.id}
                      checked={delivery === option.id}
                      onChange={() => setDelivery(option.id)}
                    />
                    <span>
                      <b>{option.name}</b>
                      <small>{option.detail}</small>
                    </span>
                    {option.label && <i>{option.label}</i>}
                    <strong>
                      {option.priceKobo === 0
                        ? "FREE"
                        : formatNaira(option.priceKobo)}
                    </strong>
                  </label>
                ))}
              </div>
              <div className="checkout-buttons">
                <button
                  type="button"
                  className="button quiet"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
                <button className="button primary" type="submit">
                  Review order
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="review-order">
              <span className="eyebrow">Step 3 of 3</span>
              <h1>
                {isDeliveryPayment
                  ? "Review and place your order."
                  : "Review and pay."}
              </h1>
              <p>
                {isDeliveryPayment
                  ? "Renova revalidates the order and reserves delivery capacity after you confirm."
                  : "Paystack opens only after Renova’s server revalidates prices, availability and delivery."}
              </p>
              <div className="review-block">
                <span>Delivering to</span>
                <b>{details.fullName}</b>
                <small>
                  {details.streetAddress}
                  {details.addressLineTwo
                    ? `, ${details.addressLineTwo}`
                    : ""}, {details.cityTown}, {details.lga},{" "}
                  {selectedState
                    ? stateLabel(selectedState.code, selectedState.name)
                    : "Nigeria"}
                </small>
                <button type="button" onClick={() => setStep(1)}>
                  Change
                </button>
              </div>
              <div className="review-block">
                <span>Delivery method</span>
                <b>{selectedDelivery.name}</b>
                <small>{selectedDelivery.detail}</small>
                <button type="button" onClick={() => setStep(2)}>
                  Change
                </button>
              </div>
              <div className="review-block">
                <span>Payment method</span>
                <b>
                  {isDeliveryPayment
                    ? "Payment on delivery"
                    : "Paystack secure checkout"}
                </b>
                <small>
                  {isDeliveryPayment
                    ? `Pay ${formatNaira(total)} when the carrier delivers your order.`
                    : "Card, bank transfer and other enabled Paystack methods."}
                </small>
              </div>
              <div className="final-trust-panel" aria-label="Order protections">
                <article>
                  <i aria-hidden="true">↻</i>
                  <span>
                    <b>7-day return requests</b>
                    <small>
                      Eligible goods can be requested for return within seven
                      days. Policy conditions apply.
                    </small>
                  </span>
                  <Link href="/returns">View policy →</Link>
                </article>
                <article>
                  <i aria-hidden="true">✓</i>
                  <span>
                    <b>
                      {isDeliveryPayment
                        ? "Pay on delivery"
                        : "Paystack protected"}
                    </b>
                    <small>
                      {isDeliveryPayment
                        ? "Pay only when your order reaches you."
                        : "Payment is verified before your order is confirmed."}
                    </small>
                  </span>
                </article>
                <article>
                  <i aria-hidden="true">↗</i>
                  <span>
                    <b>Tracked delivery</b>
                    <small>
                      Follow your order from confirmation through delivery.
                    </small>
                  </span>
                </article>
              </div>
              {whatsappNumber ? (
                <a
                  className="checkout-whatsapp-support"
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                    `Hello Renova Support, I need help before placing my order for ${formatNaira(total)}.`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="whatsapp-mark" aria-hidden="true">
                    ◔
                  </span>
                  <span>
                    <b>Need help before placing your order?</b>
                    <small>Chat with Renova Support on WhatsApp</small>
                  </span>
                  <strong>Chat now →</strong>
                </a>
              ) : null}
              <label className="policy-check">
                <input
                  type="checkbox"
                  checked={policyAccepted}
                  onChange={(event) => setPolicyAccepted(event.target.checked)}
                />
                <span>
                  I agree to the <Link href="/delivery">Delivery Policy</Link>,{" "}
                  <Link href="/returns">Refund and Returns Policy</Link> and{" "}
                  <Link href="/terms">Terms</Link>.
                </span>
              </label>
              {notice && <div className="integration-notice">{notice}</div>}
              <div className="checkout-buttons">
                <button
                  type="button"
                  className="button quiet"
                  onClick={() => setStep(2)}
                >
                  Back
                </button>
                {isDeliveryPayment ? (
                  <button
                    className="button primary"
                    disabled={paying}
                    onClick={() =>
                      policyAccepted
                        ? setDeliveryConfirmationOpen(true)
                        : setNotice(
                            "Accept the policies before placing your order.",
                          )
                    }
                  >
                    {paying ? "Placing order…" : "Place order"}
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={paying}
                    onClick={beginPayment}
                  >
                    {paying
                      ? "Opening Paystack…"
                      : `Pay ${formatNaira(total)} securely`}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
        <aside className="checkout-summary">
          <span className="eyebrow">Your order</span>
          {lines.map((line) => (
            <article key={`${line.slug}-${line.variant}`}>
              <div>
                <img src={line.imageUrl} alt="" />
                <b>{line.quantity}</b>
              </div>
              <span>
                <strong>{line.name}</strong>
                <small>{line.variant}</small>
              </span>
              <p>{formatNaira(line.priceKobo * line.quantity)}</p>
            </article>
          ))}
          <div className="summary-lines">
            <p>
              <span>Subtotal</span>
              <b>{formatNaira(subtotalKobo)}</b>
            </p>
            <p>
              <span>Delivery</span>
              <b>
                {selectedDelivery.priceKobo === 0
                  ? "Free"
                  : formatNaira(selectedDelivery.priceKobo)}
              </b>
            </p>
            <p className="total">
              <span>Total</span>
              <b>{formatNaira(total)}</b>
            </p>
          </div>
          <div className="checkout-assurance">
            <b>↻ Seven-day return policy</b>
            <span>
              Eligible return requests are accepted within seven days after
              delivery.
            </span>
          </div>
          <div className="checkout-assurance">
            <b>
              {isDeliveryPayment
                ? "✓ Payment on delivery"
                : "✓ Paystack verified"}
            </b>
            <span>
              {isDeliveryPayment
                ? "Pay the carrier when your order arrives."
                : "Payment status changes only after secure verification."}
            </span>
          </div>
        </aside>
      </div>
      {deliveryConfirmationOpen && (
        <div
          className="cod-confirmation"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cod-title"
        >
          <button
            className="modal-scrim"
            aria-label="Close"
            onClick={() => !paying && setDeliveryConfirmationOpen(false)}
          />
          <section>
            <span className="eyebrow">Please confirm</span>
            <h2 id="cod-title">Do you intend to receive this order?</h2>
            <p>
              Renova reserves carrier capacity and prepares this order for you.
              Payment on delivery is not a free reservation. Continue only if
              your delivery details are correct and you intend to receive and
              pay <b>{formatNaira(total)}</b> when the order arrives.
            </p>
            <div>
              <button
                className="button quiet"
                disabled={paying}
                onClick={() => setDeliveryConfirmationOpen(false)}
              >
                No, not yet
              </button>
              <button
                className="button primary"
                disabled={paying}
                onClick={placeDeliveryPaymentOrder}
              >
                {paying ? "Placing order…" : "Yes, place my order"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
