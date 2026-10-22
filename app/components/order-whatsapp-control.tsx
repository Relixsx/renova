"use client";

import { useState, type FormEvent } from "react";
import { confirmedOrder } from "../lib/whatsapp-message";
import styles from "./customer-reminder-bot.module.css";

export type WhatsAppContact = { orderId: number; phone?: string | null; consentAt?: string | null; optedOutAt?: string | null };
type ControlOrder = { id: number; customerPhone: string; status: string; paymentMethod?: string; paymentStatus: string };
type ControlReminder = { active: boolean; whatsappEnabled: boolean };
export type WhatsAppControlResult = { reminder?: { id: number; orderId: number; active: boolean; consentConfirmed: boolean; emailEnabled: boolean; whatsappEnabled: boolean; smsEnabled: boolean; currentCheckpoint: string; deliveryEstimate: string; customerNote: string; nextSendAt?: string | null }; contact?: WhatsAppContact; delivery?: { status: string; error?: string }; message?: string; error?: string };

export function OrderWhatsAppControl({ order, reminder, contact, configured, loading, onChanged }: {
  order: ControlOrder; reminder?: ControlReminder; contact: WhatsAppContact;
  configured: boolean; loading: boolean; onChanged: (result: WhatsAppControlResult) => void | Promise<void>;
}) {
  const [phone, setPhone] = useState(contact.phone || order.customerPhone);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const on = Boolean(reminder?.active && reminder.whatsappEnabled && !contact.optedOutAt);
  const eligible = confirmedOrder({ ...order, paymentMethod: order.paymentMethod || "paystack" });

  async function act(action: "start_whatsapp" | "stop_whatsapp", event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(action === "start_whatsapp" ? "Starting WhatsApp updates…" : "Stopping WhatsApp updates…");
    try {
      const response = await fetch("/api/orders/reminders", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, orderId: order.id, whatsappPhone: contact.consentAt ? contact.phone : phone, consentConfirmed: Boolean(contact.consentAt) || agreed }) });
      const result = await response.json() as WhatsAppControlResult;
      if (!response.ok) throw new Error(result.error || "The WhatsApp setting could not be changed.");
      await onChanged(result);
      setMessage([result.message || "Saved.", result.delivery?.error].filter(Boolean).join(" "));
    } catch (error) { setMessage(error instanceof Error ? error.message : "The WhatsApp setting could not be changed."); }
    finally { setBusy(false); }
  }

  return <section className={styles.orderWhatsApp} aria-label={`WhatsApp notifications for order ${order.id}`}>
    <div className={styles.controlHeading}><b>WhatsApp notifications: {loading ? "Loading…" : on ? "On" : "Off"}</b>
      <span>{on ? "An update every 24 hours while this order is awaiting delivery." : "Start or stop WhatsApp for this order independently."}</span>
    </div>
    {on ? <div className={styles.controlActions}>
      <span>Recipient: +{contact.phone}</span>
      <button type="button" className="button quiet" disabled={busy || loading} onClick={() => void act("stop_whatsapp")}>Stop WhatsApp notifications</button>
    </div> : contact.optedOutAt ? <p>This customer requested STOP. WhatsApp cannot be restarted for this order.</p>
      : !eligible ? <p>{["delivered", "collected", "cancelled", "refunded"].includes(order.status) ? "Updates are stopped because this order is complete or cancelled." : "Confirm this order and verify any prepaid payment before starting updates."}</p>
      : <form className={styles.controlForm} onSubmit={(event) => void act("start_whatsapp", event)}>
        {contact.consentAt ? <p>Recipient: +{contact.phone}. Customer agreement is recorded.</p> : <>
          <label className={styles.field}><span>Customer WhatsApp number</span>
            <input required type="tel" inputMode="tel" value={phone} disabled={busy || loading} onChange={(event) => setPhone(event.target.value)} />
            <small>Confirm this is the customer&apos;s WhatsApp number. It can differ from their delivery phone.</small>
          </label>
          <label className={styles.consent}><input required type="checkbox" checked={agreed} disabled={busy || loading} onChange={(event) => setAgreed(event.target.checked)} />
            <span>This customer agreed to receive Renova order updates on WhatsApp at this number.</span>
          </label>
        </>}
        <div className={styles.controlActions}>
          <button className="button primary" type="submit" disabled={busy || loading || !configured}>{contact.consentAt ? "Restart WhatsApp notifications" : "Send WhatsApp notification"}</button>
          <small>Sends the current order update now, then daily until you stop it or the order is completed.</small>
        </div>
        {!configured && !loading && <p>WhatsApp sending is paused or needs configuration.</p>}
      </form>}
    {message && <p className={styles.controlMessage} role="status">{message}</p>}
  </section>;
}
