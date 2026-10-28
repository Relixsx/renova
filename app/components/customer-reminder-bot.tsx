"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./customer-reminder-bot.module.css";
import { standardDeliveryEstimate } from "../lib/delivery-estimate";
import { DEFAULT_REMINDER_MESSAGES, type MessageDefaults } from "../lib/reminder-message-content";
import { OrderReminderMessageEditor, StoreReminderMessageDefaults, type MessageEditorReminder } from "./reminder-message-editor";
import { confirmedOrder } from "../lib/whatsapp-message";
import { OrderWhatsAppControl, type WhatsAppContact, type WhatsAppControlResult } from "./order-whatsapp-control";
import { reminderOrderView, reminderStatusFor, type ReminderFilter } from "../lib/reminder-status";
import { ReminderStatusFilters, StopOrderReminders } from "./reminder-status-filters";

type Order = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  whatsappPhone?: string | null;
  whatsappConsentAt?: string | null;
  whatsappOptedOutAt?: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  estimatedDelivery?: string | null;
  addressJson?: string | null;
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
  messageOverridesJson?: string;
  reminderPhase?: string;
  arrivalCheckpoint?: string;
  arrivalConfirmedAt?: string | null;
  lastSentAt?: string | null;
  nextSendAt?: string | null;
  startedAt?: string | null;
  stoppedAt?: string | null;
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

export function CustomerReminderBot({ orders, compact = false }: { orders: Order[]; compact?: boolean }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [messageSettingsLoaded, setMessageSettingsLoaded] = useState(false);
  const [messageDefaults, setMessageDefaults] = useState<MessageDefaults>(DEFAULT_REMINDER_MESSAGES);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [loadingRequest, setLoading] = useState(true);
  const [loadedOrders, setLoadedOrders] = useState<Order[] | null>(null);
  const loading = loadingRequest || loadedOrders !== orders;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ReminderFilter>(compact ? "all" : "running");
  const [reload, setReload] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean; destination?: ReminderFilter } | null>(null);
  const [providers, setProviders] = useState<Providers>({ email: false, whatsapp: false, sms: false });
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [busyOrder, setBusyOrder] = useState<number | null>(null);
  const [stoppingOrder, setStoppingOrder] = useState<number | null>(null);
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  const [checkedMessages, setCheckedMessages] = useState<Record<number, boolean>>({});

  const view = useMemo(() => reminderOrderView(orders, reminders, contacts, filter, search), [orders, reminders, contacts, filter, search]);
  const filterLabel = filter === "not_started" ? "not started" : filter;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders/reminders", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { reminders?: Reminder[]; messageDefaults?: MessageDefaults; providers?: Providers; whatsappMessages?: WhatsAppMessage[]; whatsappContacts?: WhatsAppContact[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not load reminders.");
        if (cancelled) return;
        const rows = payload.reminders ?? [];
        setLoadedOrders(orders);
        setMessageDefaults(payload.messageDefaults ?? DEFAULT_REMINDER_MESSAGES);
        setMessageSettingsLoaded(true);
        setReminders(rows);
        setContacts(payload.whatsappContacts ?? []);
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
            deliveryEstimate: standardDeliveryEstimate(reminder?.deliveryEstimate || order.estimatedDelivery, order.addressJson),
            customerNote: reminder?.customerNote ?? "",
            arrivalMessage: "",
          }];
        })));
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadedOrders(orders);
        setMessageSettingsLoaded(false);
        setMessages({ 0: error instanceof Error ? error.message : "Could not load reminders." });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orders, reload]);

  function draftFor(order: Order): Draft {
    return drafts[order.id] ?? {
      consentConfirmed: false,
      emailEnabled: providers.email,
      whatsappEnabled: false,
      smsEnabled: false,
      currentCheckpoint: "",
      deliveryEstimate: standardDeliveryEstimate(order.estimatedDelivery, order.addressJson),
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
          deliveryEstimate: standardDeliveryEstimate(order.estimatedDelivery, order.addressJson),
          customerNote: "",
          arrivalMessage: "",
        }),
        ...changes,
      },
    }));
  }

  async function act(order: Order, action: "start" | "save" | "send_now" | "arrival" | "stop" | "opt_out_whatsapp" | "retry_whatsapp", retry?: WhatsAppMessage) {
    if (busyOrder !== null || loading) return;
    if (retry) setCheckedMessages((current) => ({ ...current, [retry.id]: false }));
    setBusyOrder(order.id);
    if (action === "stop") setStoppingOrder(order.id);
    if (action === "stop") setFeedback({ text: `Stopping all reminders for ${order.orderNumber}…` });
    setMessages((current) => ({ ...current, [order.id]: action === "stop" ? "Stopping reminders…" : action === "save" ? "Saving update…" : "Processing reminder action…" }));
    try {
      const response = await fetch("/api/orders/reminders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "stop" ? { action, orderId: order.id } : { action, orderId: order.id, ...draftFor(order), messageId: retry?.id, checkedWhatsAppManager: retry ? checkedMessages[retry.id] === true : false }),
      });
      const payload = await response.json() as { reminder?: Reminder; message?: string; preview?: string; confirmationPreview?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Reminder action failed.");
      if (payload.reminder) setReminders((current) => [payload.reminder!, ...current.filter((row) => row.orderId !== order.id)]);
      setMessages((current) => ({ ...current, [order.id]: payload.message ?? "Saved." }));
      if (action === "stop") setFeedback({ text: `${order.orderNumber}: All reminder channels stopped.`, destination: "stopped" });
      try {
        const refresh = await fetch("/api/orders/reminders", { cache: "no-store" });
        if (refresh.ok) {
          const data = await refresh.json() as { reminders: Reminder[]; whatsappMessages: WhatsAppMessage[]; whatsappContacts: WhatsAppContact[] };
          setReminders(data.reminders); setWhatsappMessages(data.whatsappMessages); setContacts(data.whatsappContacts ?? []);
        }
      } catch { /* Keep the successful action visible if the status refresh fails. */ }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Reminder action failed.";
      setMessages((current) => ({ ...current, [order.id]: text }));
      if (action === "stop") setFeedback({ text: `${order.orderNumber}: ${text}`, error: true });
    } finally {
      setBusyOrder(null);
      setStoppingOrder(null);
    }
  }

  async function controlChanged(result: WhatsAppControlResult) {
    if (result.contact) setContacts((current) => [result.contact!, ...current.filter((row) => row.orderId !== result.contact!.orderId)]);
    if (result.reminder) {
      const reminder = result.reminder;
      setReminders((current) => [reminder, ...current.filter((row) => row.orderId !== reminder.orderId)]);
      update(reminder.orderId, { consentConfirmed: reminder.consentConfirmed, emailEnabled: reminder.emailEnabled, whatsappEnabled: reminder.whatsappEnabled, smsEnabled: reminder.smsEnabled });
      const order = orders.find((row) => row.id === reminder.orderId);
      setFeedback({ text: `${order?.orderNumber || "Order"}: ${result.message || "WhatsApp settings saved."}`, destination: reminderStatusFor(reminder) });
    }
    try {
      const response = await fetch("/api/orders/reminders", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json() as { reminders: Reminder[]; whatsappMessages: WhatsAppMessage[]; whatsappContacts: WhatsAppContact[] };
        setReminders(data.reminders); setWhatsappMessages(data.whatsappMessages); setContacts(data.whatsappContacts ?? []);
      }
    } catch { /* The saved result stays visible if the status refresh fails. */ }
  }

  return (
    <section className={styles.panel} id="reminders">
      <header className={styles.head}>
        <div>
          <span className="eyebrow">Delivery assurance</span>
          <h2>{compact ? "WhatsApp notifications for your orders" : "Customer reminder bot"}</h2>
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
      <p className={styles.notice}>New orders receive an automatic confirmation and daily WhatsApp updates. Open an order’s messages below to edit the wording and Jumia dates. For older orders, record the customer’s agreement before starting WhatsApp.</p>
      <ReminderStatusFilters filter={filter} counts={view.counts} loading={loading || !messageSettingsLoaded} onChange={setFilter} />
      <div className={styles.orderFilters}>
        <label className={styles.field}><span>Find an order or customer</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order number, name, phone or email" /></label>
        {search && <button className="button quiet" type="button" onClick={() => setSearch("")}>Clear search</button>}
      </div>
      {feedback && <div className={`${styles.notice} ${styles.filterFeedback}`} role={feedback.error ? "alert" : "status"}>
        <span>{feedback.text}</span>
        {feedback.destination && filter !== feedback.destination && <button type="button" onClick={() => setFilter(feedback.destination!)}>View {feedback.destination === "not_started" ? "not started" : feedback.destination} reminders</button>}
      </div>}
      {messageSettingsLoaded && !loading && <p className={styles.filterSummary} role="status">Showing {view.orders.length} of {view.counts[filter]} {filterLabel === "all" ? "orders" : `${filterLabel} orders`}{search.trim() ? ` matching “${search.trim()}”` : ""}.</p>}
      {messageSettingsLoaded && !loading && !compact && <StoreReminderMessageDefaults defaults={messageDefaults} onSaved={setMessageDefaults} />}
      {loading ? <p className={styles.empty} role="status">Loading reminder status…</p> : !messageSettingsLoaded ? <div className={styles.empty}>
        <p role="alert">{messages[0] || "Could not load reminder status."}</p><button className="button quiet" type="button" onClick={() => { setLoading(true); setMessageSettingsLoaded(false); setReload((value) => value + 1); }}>Retry loading reminders</button>
      </div> : view.orders.length ? (
        <div className={styles.list}>
          {view.orders.map((order) => {
            const reminder = reminders.find((row) => row.orderId === order.id);
            const group = reminderStatusFor(reminder);
            const draft = draftFor(order);
            const contact = contacts.find((row) => row.orderId === order.id) ?? { orderId: order.id, phone: order.whatsappPhone, consentAt: order.whatsappConsentAt, optedOutAt: order.whatsappOptedOutAt };
            return (
              <article className={styles.card} key={order.id} id={`whatsapp-order-${order.id}`}>
                <header className={styles.cardHead}>
                  <div className={styles.identity}>
                    <b>{order.orderNumber} · {order.customerName}</b>
                    <span>Email: {order.customerEmail}</span>
                    <span>Delivery phone: {order.customerPhone}</span>
                    <span>WhatsApp: {contact.phone || "Not recorded; confirm the number below"}</span>
                    <small>Order status: {order.status}{contact.consentAt ? " · WhatsApp agreement recorded" : ""}</small>
                  </div>
                  <div className={styles.reminderCardActions}>
                    <i className={`${styles.status} ${group === "running" ? styles.active : ""}`}>{group === "running" ? reminder?.reminderPhase === "arrival" ? "Running · Arrival reminders" : "Running · Daily reminders" : group === "stopped" ? "Stopped" : "Not started"}</i>
                    {reminder?.active && <StopOrderReminders orderNumber={order.orderNumber} busy={busyOrder !== null} stopping={stoppingOrder === order.id} onStop={() => void act(order, "stop")} />}
                    {reminder?.active && <small>Stops WhatsApp, email and SMS for this order.</small>}
                  </div>
                </header>
                <OrderWhatsAppControl order={order} reminder={reminder} contact={contact} configured={providers.whatsapp} loading={loading} onChanged={controlChanged} />
                {reminder && <div className={styles.controlTiming}>Next WhatsApp update: {reminder.active && reminder.whatsappEnabled ? formatTime(reminder.nextSendAt) : "Off"}</div>}
                {messageSettingsLoaded && !loading && <OrderReminderMessageEditor key={order.id} order={order} reminder={reminder} defaults={messageDefaults} onSaved={async (updated: MessageEditorReminder) => { setReminders((current) => [updated, ...current.filter((row) => row.orderId !== updated.orderId)]); setDrafts((current) => ({ ...current, [updated.orderId]: { ...draftFor(order), currentCheckpoint: updated.currentCheckpoint, deliveryEstimate: updated.deliveryEstimate, customerNote: updated.customerNote } })); const response = await fetch("/api/orders/reminders", { cache: "no-store" }); if (response.ok) { const data = await response.json(); setWhatsappMessages(data.whatsappMessages ?? []); } }} />}
                {!compact && confirmedOrder({ ...order, paymentMethod: order.paymentMethod || "paystack" }) && <details className={styles.advanced}>
                  <summary>Sending preferences · email, SMS and manual controls</summary>
                  <div className={styles.form}>
                  <div className={`${styles.channels} ${styles.wide}`}>
                    <b className={styles.channelTitle}>Send through</b>
                    <label><input type="checkbox" checked={draft.emailEnabled} disabled={!providers.email} onChange={(event) => update(order.id, { emailEnabled: event.target.checked })} /> Email</label>
                    <span>WhatsApp: {reminder?.active && reminder.whatsappEnabled ? "On" : "Off"}. Use the order controls above.</span>
                    <label><input type="checkbox" checked={draft.smsEnabled} disabled={!providers.sms} onChange={(event) => update(order.id, { smsEnabled: event.target.checked })} /> SMS</label>
                  </div>
                  <label className={`${styles.consent} ${styles.wide}`}>
                    <input type="checkbox" checked={draft.consentConfirmed} onChange={(event) => update(order.id, { consentConfirmed: event.target.checked })} />
                    <span>I confirm this customer agreed to receive transactional delivery updates through the selected channels.</span>
                  </label>
                  {reminder && <div className={styles.timing}><span>Last accepted by a provider: {formatTime(reminder.lastSentAt)}</span><span>Next scheduled: {reminder.active ? formatTime(reminder.nextSendAt) : "Stopped"}</span></div>}
                  <div className={`${styles.actions} ${styles.wide}`}>
                    {reminder?.active ? (
                      <>
                        <button className="button quiet" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "save")}>Save for next update</button>
                        <button className="button primary" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "send_now")}>Save update & send now</button>
                        {reminder.whatsappEnabled && <button className="button quiet" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "opt_out_whatsapp")}>Record customer opt-out for this number</button>}
                      </>
                    ) : (
                      <button className="button primary" type="button" disabled={busyOrder === order.id} onClick={() => void act(order, "start")}>Start selected reminder channels</button>
                    )}
                    {messages[order.id] && <span className={styles.message} role="status">{messages[order.id]}</span>}
                  </div>


                  </div>
                </details>}
                  <div className={`${styles.wide} ${styles.receipts}`}>
                    {whatsappMessages.some((message) => message.orderId === order.id) && <h3 className={styles.receiptHeading}>Recent WhatsApp deliveries</h3>}
                    {whatsappMessages.filter((message) => message.orderId === order.id).slice(0, 3).map((message) => <div key={message.id}>
                      <p><b>WhatsApp {message.kind === "routine" ? "daily update" : message.kind === "confirmation" ? "order confirmation" : message.kind === "activation" ? "manually started update" : "arrival update"}: {message.status === "pending" ? "queued" : message.status}</b> · {formatTime(message.updatedAt)}</p>
                      {message.errorMessage && <p>{message.errorMessage}</p>}
                      {message.status === "uncertain" && <label><input type="checkbox" checked={checkedMessages[message.id] ?? false} onChange={(event) => setCheckedMessages((current) => ({ ...current, [message.id]: event.target.checked }))} /> I checked WhatsApp Manager and confirmed this message was not delivered.</label>}
                      {["failed", "uncertain"].includes(message.status) && <button type="button" className="button quiet" disabled={busyOrder === order.id || (message.status === "uncertain" && !checkedMessages[message.id])} onClick={() => void act(order, "retry_whatsapp", message)}>Retry WhatsApp message</button>}
                    </div>)}
                  </div>
              </article>
            );
          })}
        </div>
      ) : <div className={styles.empty}>
        <p>{search.trim() ? `No ${filterLabel === "all" ? "" : `${filterLabel} `}orders match this search.` : filter === "running" ? "No reminders are currently running." : filter === "stopped" ? "No previously started reminders are stopped." : filter === "not_started" ? "Every order has started reminders at least once." : "No orders yet."}</p>
        {filter !== "all" && <button className="button quiet" type="button" onClick={() => setFilter("all")}>View all orders</button>}
      </div>}
    </section>
  );
}
