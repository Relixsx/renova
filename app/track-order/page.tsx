"use client";

import { FormEvent, useEffect, useState } from "react";
import { StoreFrame } from "../components/storefront";

type TrackedOrder = { orderNumber: string; status: string; paymentStatus: string; carrier: string; trackingNumber?: string | null; estimatedDelivery: string };
const steps = ["payment_pending", "processing", "packaged", "dispatched", "in_transit", "delivered"];
const timeline = ["Payment confirmation", "Processing", "Packaged", "Dispatched", "In transit", "Delivered"];

export default function TrackOrderPage() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("orderNumber") || "";
    if (/^REN-[A-Z0-9-]{6,30}$/i.test(value)) setReference(value.toUpperCase());
  }, []);

  async function lookup(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setResult(null);
    try {
      const contact = email.trim();
      const response = await fetch("/api/orders/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderNumber: reference, ...(contact.includes("@") ? { email: contact } : { phone: contact }) }) });
      const payload = await response.json() as { order?: TrackedOrder; error?: string };
      if (response.ok && payload.order) setResult(payload.order); else setError(payload.error ?? "We could not match those details.");
    } catch { setError("Tracking is temporarily unavailable. Please try again."); }
    finally { setLoading(false); }
  }

  const current = result ? Math.max(0, steps.indexOf(result.status)) : 0;
  return <StoreFrame><section className="tracking-page"><div className="tracking-intro"><span className="eyebrow">Private order tracking</span><h1>Follow every step.</h1><p>Enter your order number and matching email address. For an Anagen order placed without email, use your delivery phone number instead.</p><form onSubmit={lookup}><label>Order number<input required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="REN-…"/></label><label>Email address or delivery phone<input required type="text" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com or delivery phone"/></label><button className="button primary" disabled={loading}>{loading ? "Checking…" : "Track order"}</button>{error && <p className="track-error">{error}</p>}</form></div>{result ? <div className="tracking-result"><header><div><span className="eyebrow">Order progress</span><h2>{result.orderNumber}</h2><p>Estimated delivery: {result.estimatedDelivery}</p></div><b>{result.status.replaceAll("_", " ")}</b></header><div className="tracking-timeline">{timeline.map((title, index) => <article className={index <= current ? "done" : ""} key={title}><i>{index <= current ? "✓" : ""}</i><div><h3>{index === 0 && result.paymentStatus === "payment_due_on_delivery" ? "Order confirmation" : title}</h3><p>{index === current ? "Current order stage" : index < current ? "Completed" : "Pending"}</p></div></article>)}</div><footer><span>{result.carrier}{result.trackingNumber ? ` · ${result.trackingNumber}` : ""}</span><a href="mailto:support@shoprenova.com.ng">Email support</a></footer></div> : <div className="tracking-art"><img src="/renova-mark.svg" alt=""/><blockquote>From verified payment to delivery, your order story stays visible.</blockquote></div>}</section></StoreFrame>;
}
