"use client";

import { FormEvent, useState } from "react";
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

  async function lookup(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setResult(null);
    const response = await fetch("/api/orders/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderNumber: reference, email }) });
    const payload = await response.json() as { order?: TrackedOrder; error?: string };
    if (response.ok && payload.order) setResult(payload.order); else setError(payload.error ?? "We could not match those details.");
    setLoading(false);
  }

  const current = result ? Math.max(0, steps.indexOf(result.status)) : 0;
  return <StoreFrame><section className="tracking-page"><div className="tracking-intro"><span className="eyebrow">Private order tracking</span><h1>Follow every step.</h1><p>Enter the order number and matching email address. Renova never reveals order information without both.</p><form onSubmit={lookup}><label>Order number<input required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="REN-…"/></label><label>Email used at checkout<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label><button className="button primary" disabled={loading}>{loading ? "Checking…" : "Track order"}</button>{error && <p className="track-error">{error}</p>}</form></div>{result ? <div className="tracking-result"><header><div><span className="eyebrow">Order progress</span><h2>{result.orderNumber}</h2><p>Estimated delivery: {result.estimatedDelivery}</p></div><b>{result.status.replaceAll("_", " ")}</b></header><div className="tracking-timeline">{timeline.map((title, index) => <article className={index <= current ? "done" : ""} key={title}><i>{index <= current ? "✓" : ""}</i><div><h3>{title}</h3><p>{index === current ? "Current order stage" : index < current ? "Completed" : "Pending"}</p></div></article>)}</div><footer><span>{result.carrier}{result.trackingNumber ? ` · ${result.trackingNumber}` : ""}</span><a href="mailto:support@shoprenova.com.ng">Email support</a></footer></div> : <div className="tracking-art"><img src="/renova-mark.svg" alt=""/><blockquote>From verified payment to delivery, your order story stays visible.</blockquote></div>}</section></StoreFrame>;
}
