"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./customer-reminder-bot.module.css";

type Order = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  estimatedDelivery?: string | null;
};

type Reminder = {
  id: number;
  orderId: number;
  active: boolean;
  consentConfirmed: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  currentCheckpoint: string;
  deliveryEstimate: string;
  customerNote: string;
  lastSentAt?: string | null;
  nextSendAt?: string | null;
};

type Draft = {
  consentConfirmed: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  currentCheckpoint: string;
  deliveryEstimate: string;
  customerNote: string;
};

type Providers = { email: boolean; whatsapp: boolean; sms: boolean };

function formatTime(value?: string | null) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
}

export function CustomerReminderBot({ orders }: { orders: Order[] }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [providers, setProviders] = useState<Providers>({ email: false, whatsapp: false, sms: false });
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [busyOrder, setBusyOrder] = useState<number | null>(null);

  const eligibleOrders = useMemo(
    () => orders.filter((order) => !["delivered", "refunded", "cancelled"].includes(order.status)),
    [orders],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders/reminders", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { reminders?: Reminder[]; providers?: Providers; error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not load reminders.");
        if (cancelled) return;
        const rows = payload.reminders ?? [];
        setReminders(rows);
        setProviders(payload.providers ?? { email: false, whatsapp: false, sms: false });
        setDrafts(Object.fromEntries(orders.map((order) => {
          const reminder = rows.find((row) => row.orderId === order.id);
          return [order.id, {
            consentConfirmed: reminder?.consentConfirmed ?? false,
            emailEnabled: reminder?.emailEnabled ?? Boolean(payload.providers?.email),
            whatsappEnabled: reminder?.whatsappEnabled ?? false,
            smsEnabled: reminder?.smsEnabled ?? false,
            currentCheckpoint: reminder?.currentCheckpoint ?? "Shipped and in transit",
            deliveryEstimate: reminder?.deliveryEstimate ?? order.estimatedDelivery ?? "7–14 working days",
            customerNote: reminder?.customerNote ?? "",
          }];
        })));
      })
      .catch((error) => !cancelled && setMessages({ 0: error instanceof Error ? error.message : "Could not load reminders." }));
    return () => { cancelled = true; };
  }, [orders]);

  function draftFor(order: Order): Draft {
    return drafts[order.id] ?? {
      consentConfirmed: false,
      emailEnabled: providers.email,
      whatsappEnabled: false,
      smsEnabled: false,
      currentCheckpoint: "Shipped and in transit",
      deliveryEstimate: order.estimatedDelivery ?? "7–14 working days",
      customerNote: "",
    };
  }

  function update(orderId: number, changes: Partial<Draft>) {
    const order = orders.find((row) => row.id === orderId)!;
    setDrafts((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] ?? {
          consentConfirmed: false,
          emailEnabled: providers.email,
          whatsappEnabled: false,
          smsEnabled: false,
          currentCheckpoint: "Shipped and in transit",
          deliveryEstimate: order.estimatedDelivery ?? "7–14 working days",
          customerNote: "",
        }),
        ...changes,
      },
    }));
  }

  async function act(order: Order, action: "start" | "send_now" | "stop") {
    setBusyOrder(order.id);
    setMessages((current) => ({ ...current, [order.id]: action === "stop" ? "Stopping reminders…" : "Sending verified update…" }));
    try {
      const response = await fetch("/api/orders/reminders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, orderId: order.id, ...draftFor(order) }),
      });
      const payload = await response.json() as { reminder?: Reminder; message?: string; error?: string; delivery?: { sent?: number } };
      if (!response.ok) throw new Error(payload.error || "Reminder action failed.");
      if (payload.reminder) setReminders((current) => [payload.reminder!, ...current.filter((row) => row.orderId !== order.id)]);
      const sentText = typeof payload.delivery?.sent === "number" ? ` ${payload.delivery.sent} channel${payload.delivery.sent === 1 ? "" : "s"} delivered.` : "";
      setMessages((current) => ({ ...current, [order.id]: `${payload.message ?? "Saved."}${sentText}` }));
    } catch (error) {
      setMessages((current) => ({ ...current, [order.id]: error instanceof Error ? error.message : "Reminder action failed." }));
    } finally {
      setBusyOrder(null);
    }
  }

  return (
    <section className={styles.panel} id="reminders">
      <header className={styles.head}>
        <div>
          <span className="eyebrow">Delivery assurance</span>
          <h2>Customer reminder bot</h2>
          <p>Sends the latest verified delivery update every 24 hours until you stop it or mark the order delivered.</p>
        </div>
        <div className={styles.providers} aria-label="Messaging provider status">
          {(["email", "whatsapp", "sms"] as const).map((channel) => (
            <span className={providers[channel] ? styles.ready : ""} key={channel}>
              {channel} · {providers[channel] ? "ready" : "setup needed"}
            </span>
          ))}
        </div>
      </header>
      <p className={styles.notice}>Only enter courier information you have verified. Renova will never tell a customer that a parcel reached a location unless you record that checkpoint here.</p>
      {messages[0] && <p className={styles.notice} role="alert">{messages[0]}</p>}
      {eligibleOrders.length ? (
        <div className={styles.list}>
          {eligibleOrders.map((order) => {
            const reminder = reminders.find((row) => row.orderId === order.id);
            const draft = draftFor(order);
            return (
              <article className={styles.card} key={order.id}>
                <header className={styles.cardHead}>
                  <div className={styles.identity}>
                    <b>{order.orderNumber} · {order.customerName}</b>
                    <span>{order.customerPhone} · {order.customerEmail}</span>
                    <small>Order status: {order.status}</small>
                  </div>
                  <i className={`${styles.status} ${reminder?.active ? styles.active : ""}`}>{reminder?.active ? "Daily reminders active" : "Stopped"}</i>
                </header>
                <div className={styles.form}>
                  <label className={`${styles.field} ${styles.wide}`}>
                    <span>Latest verified delivery update</span>
                    <input value={draft.currentCheckpoint} onChange={(event) => update(order.id, { currentCheckpoint: event.target.value })} placeholder="Example: Received at Jumia Abuja sorting hub" />
                  </label>
                  <label className={styles.field}>
                    <span>Current expected delivery</span>
                    <input value={draft.deliveryEstimate} onChange={(event) => update(order.id, { deliveryEstimate: event.target.value })} placeholder="Example: Within 7–14 working days" />
                  </label>
                  <label className={styles.field}>
                    <span>Optional reassurance note</span>
                    <textarea value={draft.customerNote} onChange={(event) => update(order.id, { customerNote: event.target.value })} placeholder="Any truthful information the customer should know" />
                  </label>
                  <div className={`${styles.channels} ${styles.wide}`}>
                    <b className={styles.channelTitle}>Send through</b>
                    <label><input type="checkbox" checked={draft.emailEnabled} disabled={!providers.email} onChange={(event) => update(order.id, { emailEnabled: event.target.checked })} /> Email</label>
                    <label><input type="checkbox" checked={draft.whatsappEnabled} disabled={!providers.whatsapp} onChange={(event) => update(order.id, { whatsappEnabled: event.target.checked })} /> WhatsApp</label>
                    <label><input type="checkbox" checked={draft.smsEnabled} disabled={!providers.sms} onChange={(event) => update(order.id, { smsEnabled: event.target.checked })} /> SMS</label>
                  </div>
                  <label className={`${styles.consent} ${styles.wide}`}>
                    <input type="checkbox" checked={draft.consentConfirmed} onChange={(event) => update(order.id, { consentConfirmed: event.target.checked })} />
                    <span>I confirm this customer agreed to receive transactional delivery updates through the selected channels.</span>
                  </label>
                  {reminder && <div className={styles.timing}><span>Last sent: {formatTime(reminder.lastSentAt)}</span><span>Next scheduled: {reminder.active ? formatTime(reminder.nextSendAt) : "Stopped"}</span></div>}
                  <div className={`${styles.actions} ${styles.wide}`}>
                    {reminder?.active ? (
                      <>
                        <button className="button primary" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "send_now")}>Save update & send now</button>
                        <button className="button quiet" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "stop")}>Stop reminders</button>
                      </>
                    ) : (
                      <button className="button primary" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "start")}>Start daily reminders</button>
                    )}
                    {messages[order.id] && <span className={styles.message} role="status">{messages[order.id]}</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : <p className={styles.empty}>There are no active orders available for reminders.</p>}
    </section>
  );
}
