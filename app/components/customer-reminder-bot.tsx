"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./customer-reminder-bot.module.css";

type Order = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  whatsappPhone?: string | null;
  whatsappConsentAt?: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
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
  arrivalMessage: string;
};

type WhatsAppMessage = { id: number; orderId: number; kind: string; status: string; errorMessage?: string | null; updatedAt: string };

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
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  const [previews, setPreviews] = useState<Record<number, { confirmation: string; routine: string }>>({});
  const [checkedMessages, setCheckedMessages] = useState<Record<number, boolean>>({});

  const eligibleOrders = useMemo(
    () => orders.filter((order) => ["confirmed", "processing", "packaged", "dispatched"].includes(order.status) && (order.paymentMethod === "cash_on_delivery" || order.paymentStatus === "paid")),
    [orders],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders/reminders", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { reminders?: Reminder[]; providers?: Providers; whatsappMessages?: WhatsAppMessage[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not load reminders.");
        if (cancelled) return;
        const rows = payload.reminders ?? [];
        setReminders(rows);
        setWhatsappMessages(payload.whatsappMessages ?? []);
        setProviders(payload.providers ?? { email: false, whatsapp: false, sms: false });
        setDrafts(Object.fromEntries(orders.map((order) => {
          const reminder = rows.find((row) => row.orderId === order.id);
          return [order.id, {
            consentConfirmed: reminder?.consentConfirmed ?? false,
            emailEnabled: reminder?.emailEnabled ?? Boolean(payload.providers?.email),
            whatsappEnabled: reminder?.whatsappEnabled ?? false,
            smsEnabled: reminder?.smsEnabled ?? false,
            currentCheckpoint: reminder?.currentCheckpoint ?? "",
            deliveryEstimate: reminder?.deliveryEstimate ?? order.estimatedDelivery ?? "",
            customerNote: reminder?.customerNote ?? "",
            arrivalMessage: "",
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
      currentCheckpoint: "",
      deliveryEstimate: order.estimatedDelivery ?? "",
      customerNote: "",
      arrivalMessage: "",
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
          currentCheckpoint: "",
          deliveryEstimate: order.estimatedDelivery ?? "",
          customerNote: "",
          arrivalMessage: "",
        }),
        ...changes,
      },
    }));
  }

  async function act(order: Order, action: "start" | "save" | "preview" | "send_now" | "arrival" | "stop" | "opt_out_whatsapp" | "retry_whatsapp", retry?: WhatsAppMessage) {
    if (retry) setCheckedMessages((current) => ({ ...current, [retry.id]: false }));
    setBusyOrder(order.id);
    setMessages((current) => ({ ...current, [order.id]: action === "stop" ? "Stopping reminders…" : action === "preview" ? "Loading previews…" : action === "save" ? "Saving update…" : "Processing reminder action…" }));
    try {
      const response = await fetch("/api/orders/reminders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, orderId: order.id, ...draftFor(order), messageId: retry?.id, checkedWhatsAppManager: retry ? checkedMessages[retry.id] === true : false }),
      });
      const payload = await response.json() as { reminder?: Reminder; message?: string; preview?: string; confirmationPreview?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Reminder action failed.");
      if (payload.reminder) setReminders((current) => [payload.reminder!, ...current.filter((row) => row.orderId !== order.id)]);
      setMessages((current) => ({ ...current, [order.id]: payload.message ?? "Saved." }));
      if (payload.preview && payload.confirmationPreview) setPreviews((current) => ({ ...current, [order.id]: { confirmation: payload.confirmationPreview!, routine: payload.preview! } }));
      const refresh = await fetch("/api/orders/reminders", { cache: "no-store" });
      if (refresh.ok) {
        const data = await refresh.json() as { reminders: Reminder[]; whatsappMessages: WhatsAppMessage[] };
        setReminders(data.reminders); setWhatsappMessages(data.whatsappMessages);
      }
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
              {channel} · {providers[channel] ? "configured" : "setup needed"}
            </span>
          ))}
        </div>
      </header>
      <p className={styles.notice}>New checkout orders automatically receive a thank-you confirmation and daily progress updates at the separate WhatsApp number provided by the customer. For older orders, record the customer&apos;s agreement before enabling WhatsApp. Leave the delivery note blank to use the current order status. Enter courier details only after you verify them.</p>
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
                    <span>Email: {order.customerEmail}</span>
                    <span>Delivery phone: {order.customerPhone}</span>
                    <span>WhatsApp: {order.whatsappPhone || "Not recorded; older orders require customer agreement"}</span>
                    <small>Order status: {order.status}{order.whatsappConsentAt ? " · WhatsApp agreement recorded" : ""}</small>
                  </div>
                  <i className={`${styles.status} ${reminder?.active ? styles.active : ""}`}>{reminder?.active ? "Daily reminders active" : "Stopped"}</i>
                </header>
                <div className={styles.form}>
                  <div className={`${styles.messagePlan} ${styles.wide}`}>
                    <div><b>1. Order confirmation</b><span>Sent automatically when the order is confirmed. Thanks the customer and includes their items, payment and delivery estimate.</span></div>
                    <div><b>2. Daily delivery update</b><span>Uses the current status and order details, at least 24 hours after the last accepted WhatsApp message. Stops after delivery, collection, cancellation or opt-out.</span></div>
                  </div>
                  <label className={`${styles.field} ${styles.wide}`}>
                    <span>Latest verified delivery update</span>
                    <input maxLength={500} value={draft.currentCheckpoint} onChange={(event) => update(order.id, { currentCheckpoint: event.target.value })} placeholder="Optional: paste a verified courier update" />
                  </label>
                  <label className={styles.field}>
                    <span>Current expected delivery</span>
                    <input maxLength={110} value={draft.deliveryEstimate} onChange={(event) => update(order.id, { deliveryEstimate: event.target.value })} placeholder="The latest estimate given by the delivery partner" />
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
                  {reminder?.active && (
                    <label className={`${styles.field} ${styles.wide}`}>
                      <span>Final arrival message from Jumia</span>
                      <textarea value={draft.arrivalMessage} onChange={(event) => update(order.id, { arrivalMessage: event.target.value })} placeholder="Paste the verified Jumia arrival or ready-for-collection message here" />
                    </label>
                  )}
                  {reminder && <div className={styles.timing}><span>Last accepted by a provider: {formatTime(reminder.lastSentAt)}</span><span>Next scheduled: {reminder.active ? formatTime(reminder.nextSendAt) : "Stopped"}</span></div>}
                  <div className={`${styles.actions} ${styles.wide}`}>
                    <button className="button quiet" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "preview")}>Preview confirmation & daily update</button>
                    {reminder?.active ? (
                      <>
                        <button className="button quiet" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "save")}>Save for next update</button>
                        <button className="button primary" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "send_now")}>Save update & send now</button>
                        <button className="button quiet" type="button" disabled={busyOrder === order.id || !draft.arrivalMessage.trim()} onClick={() => void act(order, "arrival")}>Send Jumia arrival update</button>
                        <button className="button quiet" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "stop")}>Customer collected — stop</button>
                        {reminder.whatsappEnabled && <button className="button quiet" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "opt_out_whatsapp")}>Stop WhatsApp for this number</button>}
                      </>
                    ) : (
                      <button className="button primary" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "start")}>Start daily reminders</button>
                    )}
                    {messages[order.id] && <span className={styles.message} role="status">{messages[order.id]}</span>}
                  </div>
                  {previews[order.id] && <>
                    <div className={`${styles.preview} ${styles.wide}`}><b>1. Order confirmation preview</b><small>Shown as it would appear when this order was first confirmed.</small><p>{previews[order.id].confirmation}</p></div>
                    <div className={`${styles.preview} ${styles.wide}`}><b>2. Next daily delivery update preview</b><small>Uses the current order status and the notes above. Previewing sends nothing.</small><p>{previews[order.id].routine}</p></div>
                  </>}
                  <div className={`${styles.wide} ${styles.receipts}`}>
                    {whatsappMessages.filter((message) => message.orderId === order.id).slice(0, 3).map((message) => <div key={message.id}>
                      <p><b>WhatsApp {message.kind === "routine" ? "daily update" : message.kind === "confirmation" ? "order confirmation" : "arrival update"}: {message.status === "pending" ? "queued" : message.status}</b> · {formatTime(message.updatedAt)}</p>
                      {message.errorMessage && <p>{message.errorMessage}</p>}
                      {message.status === "uncertain" && <label><input type="checkbox" checked={checkedMessages[message.id] ?? false} onChange={(event) => setCheckedMessages((current) => ({ ...current, [message.id]: event.target.checked }))} /> I checked WhatsApp Manager and confirmed this message was not delivered.</label>}
                      {["failed", "uncertain"].includes(message.status) && <button type="button" className="button quiet" disabled={busyOrder === order.id || (message.status === "uncertain" && !checkedMessages[message.id])} onClick={() => void act(order, "retry_whatsapp", message)}>Retry WhatsApp message</button>}
                    </div>)}
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
