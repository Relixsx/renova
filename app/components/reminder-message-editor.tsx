"use client";

import { useEffect, useState } from "react";
import { DEFAULT_REMINDER_MESSAGES, MESSAGE_FIELD_LIMITS, isAutomaticReminderMessage, parseMessageOverrides, resolveReminderMessage, type EditableMessageKind, type MessageDefaults, type MessageOverrides, type ReminderMessageConfig, type ReminderMessageSource } from "../lib/reminder-message-content";
import { whatsappPreview, whatsappTemplateParameters } from "../lib/whatsapp-message";
import { jumiaDeliveryCountdown, nigeriaCalendarDate, validateJumiaDeliveryWindow } from "../lib/jumia-delivery-countdown";
import styles from "./customer-reminder-bot.module.css";

export type MessageEditorReminder = ReminderMessageSource & {
  id: number; orderId: number; active: boolean; consentConfirmed: boolean;
  emailEnabled: boolean; whatsappEnabled: boolean; smsEnabled: boolean;
  currentCheckpoint: string; deliveryEstimate: string; customerNote: string;
  nextSendAt?: string | null; lastSentAt?: string | null;
};
type EditorOrder = { id: number; orderNumber: string; customerName: string };
type EmailPreview = { message: string; estimate: string; note: string; subject: string; heading: string };
type PreviewPayload = { previewNigeriaDate?: string; confirmationPreview: string; preview: string; arrivalPreview: string; emailPreviews: Record<EditableMessageKind, EmailPreview>; smsPreviews: Record<EditableMessageKind, string> };
const titleFor = (kind: EditableMessageKind) => kind === "routine" ? "2. Daily delivery update" : "3. Arrival and collection reminder";

async function messageAction(body: object) {
  const response = await fetch("/api/orders/reminders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "The message settings could not be saved.");
  return payload;
}

function MessageFields({ kind, config, onChange, prefix, jumiaWindowActive = false }: { jumiaWindowActive?: boolean; kind: EditableMessageKind; config: ReminderMessageConfig; onChange: (field: keyof ReminderMessageConfig, value: string) => void; prefix: string }) {
  return <div className={styles.editorFields}>
    <label className={styles.field}><span>{kind === "routine" ? "Custom daily wording (optional)" : "Custom arrival wording (optional)"}</span><textarea id={`${prefix}-message`} rows={3} maxLength={MESSAGE_FIELD_LIMITS.message} value={isAutomaticReminderMessage(kind, config.message) ? "" : config.message} placeholder="Leave blank to use the ready-made message" onChange={(event) => onChange("message", event.target.value || DEFAULT_REMINDER_MESSAGES[kind].message)} /><small>The standard message is ready to use. The customer, order, items and payment details fill in automatically.</small></label>
    <label className={styles.field}><span>{kind === "routine" ? jumiaWindowActive ? "Fallback delivery line (Jumia dates are in use)" : "Expected delivery line" : "Arrival or collection line"}</span><input disabled={kind === "routine" && jumiaWindowActive} maxLength={MESSAGE_FIELD_LIMITS.deliveryEstimate} value={config.deliveryEstimate} onChange={(event) => onChange("deliveryEstimate", event.target.value)} placeholder={kind === "routine" ? "Leave blank for the order's Lagos or outside-Lagos estimate" : "For example: Ready for collection now"} /><small>{kind === "routine" ? jumiaWindowActive ? "The saved Jumia date window supplies this daily reminder's expected-delivery line. Clear those dates to use this fallback." : "Blank uses the order's regional estimate or a specific courier date." : "Use a collection deadline or other verified arrival information."}</small></label>
    <label className={styles.field}><span>Customer instructions or reassurance</span><textarea rows={2} maxLength={MESSAGE_FIELD_LIMITS.note} value={config.note} onChange={(event) => onChange("note", event.target.value)} /><small>{config.note.length}/{MESSAGE_FIELD_LIMITS.note} characters</small></label>
    <details className={styles.emailFields}><summary>Edit email subject and heading</summary><div className={styles.editorFields}>
      <label className={styles.field}><span>Email subject</span><input maxLength={MESSAGE_FIELD_LIMITS.emailSubject} value={config.emailSubject} onChange={(event) => onChange("emailSubject", event.target.value)} /></label>
      <label className={styles.field}><span>Email heading</span><input maxLength={MESSAGE_FIELD_LIMITS.emailHeading} value={config.emailHeading} onChange={(event) => onChange("emailHeading", event.target.value)} /></label>
    </div></details>
  </div>;
}

function MessageTabs({ kind, onChange }: { kind: EditableMessageKind; onChange: (kind: EditableMessageKind) => void }) {
  return <div className={styles.messageTabs} aria-label="Message type">{(["routine", "arrival"] as const).map((value) => <button type="button" aria-pressed={kind === value} key={value} onClick={() => onChange(value)}>{titleFor(value)}</button>)}</div>;
}

export function StoreReminderMessageDefaults({ defaults, onSaved }: { defaults: MessageDefaults; onSaved: (defaults: MessageDefaults) => void }) {
  const [draft, setDraft] = useState<MessageDefaults>(defaults);
  const [kind, setKind] = useState<EditableMessageKind>("routine");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const sample = { customerName: "Sample Customer", orderNumber: "PREVIEW-ONLY", customerPhone: "", status: "dispatched", paymentMethod: "cash_on_delivery", paymentStatus: "payment_due_on_delivery", totalKobo: 2450000, itemsJson: '[{"name":"Sample product","quantity":1}]', addressJson: '{"stateCode":"LA"}', estimatedDelivery: "3–5 working days" };
  async function save() {
    setBusy(true); setMessage("");
    try { const result = await messageAction({ action: "save_message_defaults", messageDefaults: draft }); onSaved(result.messageDefaults); setDraft(result.messageDefaults); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save defaults."); }
    finally { setBusy(false); }
  }
  return <details className={styles.storeDefaults}><summary>Optional: change the store’s message wording</summary><div className={styles.editorBody}><fieldset disabled={busy} className={styles.editorFieldset}>
    <p>Renova already prepares complete daily and arrival messages. Change these defaults only if you want different wording. Each customer’s details and countdown are added automatically.</p>
    <MessageTabs kind={kind} onChange={setKind} />
    <div className={styles.preview}><b>Ready-made {kind === "routine" ? "daily" : "arrival"} message example</b><p>{whatsappPreview(whatsappTemplateParameters(sample, { currentCheckpoint: "", customerNote: "", deliveryEstimate: "", arrivalCheckpoint: kind === "arrival" ? "Sample collection point. Please bring your collection code." : "", reminderPhase: kind === "arrival" ? "arrival" : "delivery" }, kind, draft))}</p></div>
    <MessageFields prefix="store-default" kind={kind} config={draft[kind]} onChange={(field, value) => setDraft((current) => ({ ...current, [kind]: { ...current[kind], [field]: value } }))} />
    <div className={styles.editorActions}><button type="button" className="button primary" disabled={busy} onClick={() => void save()}>Save default messages</button><button type="button" className="button quiet" disabled={busy} onClick={() => setDraft((current) => ({ ...current, [kind]: { ...DEFAULT_REMINDER_MESSAGES[kind] } }))}>Use the ready-made message</button></div>
    {message && <p role="status">{message}</p>}
    <p className={styles.editorHint}>The preview uses your approved Meta template. Default changes apply where an order has no custom wording. The first order confirmation stays separate.</p>
  </fieldset></div></details>;
}

export function OrderReminderMessageEditor({ order, reminder, defaults, onSaved }: { order: EditorOrder; reminder?: MessageEditorReminder; defaults: MessageDefaults; onSaved: (reminder: MessageEditorReminder) => void | Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState<EditableMessageKind>(reminder?.reminderPhase === "arrival" ? "arrival" : "routine");
  const [overrides, setOverrides] = useState<MessageOverrides>(() => parseMessageOverrides(reminder?.messageOverridesJson));
  const [checkpoint, setCheckpoint] = useState(reminder?.currentCheckpoint || "");
  const [arrivalCheckpoint, setArrivalCheckpoint] = useState(reminder?.arrivalCheckpoint || "");
  const [arrivalConfirmed, setArrivalConfirmed] = useState(false);
  const [jumiaFrom, setJumiaFrom] = useState(reminder?.jumiaDeliveryFrom || "");
  const [jumiaTo, setJumiaTo] = useState(reminder?.jumiaDeliveryTo || "");
  const [datesEdited, setDatesEdited] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setClock((previous) => {
      const current = new Date();
      return previous && nigeriaCalendarDate(previous) === nigeriaCalendarDate(current) ? previous : current;
    });
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  const [editedKinds, setEditedKinds] = useState<EditableMessageKind[]>([]);
  const [editedCheckpoints, setEditedCheckpoints] = useState<{ routine: boolean; arrival: boolean }>({ routine: false, arrival: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [previewResult, setPreviewResult] = useState<{ key: string; payload?: PreviewPayload; error?: string } | null>(null);
  let dateError = "";
  let countdown: ReturnType<typeof jumiaDeliveryCountdown> = null;
  try { const dates = validateJumiaDeliveryWindow({ from: jumiaFrom, to: jumiaTo }); if (clock && dates.from) countdown = jumiaDeliveryCountdown({ jumiaDeliveryFrom: dates.from, jumiaDeliveryTo: dates.to }, clock); } catch (error) { dateError = error instanceof Error ? error.message : "Check the Jumia dates."; }
  const source = { ...reminder, jumiaDeliveryFrom: jumiaFrom || null, jumiaDeliveryTo: jumiaTo || jumiaFrom || null, currentCheckpoint: checkpoint, arrivalCheckpoint, messageOverridesJson: JSON.stringify(overrides) };
  const config = resolveReminderMessage(kind, source, defaults);
  const previewBody = JSON.stringify({ action: "preview", orderId: order.id, messageOverrides: overrides, currentCheckpoint: checkpoint, arrivalCheckpoint, jumiaDeliveryWindow: { from: jumiaFrom, to: jumiaTo } });
  const previewDay = clock ? nigeriaCalendarDate(clock) : "";
  const previewKey = `${previewDay}:${previewBody}:${JSON.stringify(defaults)}`;
  const previews = previewResult?.key === previewKey ? previewResult.payload : undefined;
  const previewError = previewResult?.key === previewKey ? previewResult.error : undefined;
  useEffect(() => {
    if (!expanded || !previewDay || dateError) return;
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/orders/reminders", { method: "POST", headers: { "content-type": "application/json" }, body: previewBody, signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "The message preview could not be loaded.");
        if (current) setPreviewResult({ key: previewKey, payload });
      } catch (error) {
        if (current && !controller.signal.aborted) setPreviewResult({ key: previewKey, error: error instanceof Error ? error.message : "The preview could not be loaded." });
      }
    }, 200);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [expanded, previewDay, dateError, previewBody, previewKey]);
  function changed() { setMessage(""); }
  async function act(action: "save_message_edits" | "activate_arrival") {
    setBusy(true); setMessage("");
    try {
      const payload = await messageAction({ action, orderId: order.id, messageOverrides: Object.fromEntries(editedKinds.map((value) => [value, overrides[value]])), ...(editedCheckpoints.routine ? { currentCheckpoint: checkpoint } : {}), ...(action === "activate_arrival" || editedCheckpoints.arrival ? { arrivalCheckpoint } : {}), arrivalConfirmed, ...(datesEdited ? { jumiaDeliveryWindow: { from: jumiaFrom, to: jumiaTo } } : {}) });
      if (payload.reminder) { setOverrides(parseMessageOverrides(payload.reminder.messageOverridesJson)); setCheckpoint(payload.reminder.currentCheckpoint || ""); setArrivalCheckpoint(payload.reminder.arrivalCheckpoint || ""); setJumiaFrom(payload.reminder.jumiaDeliveryFrom || ""); setJumiaTo(payload.reminder.jumiaDeliveryTo || ""); setDatesEdited(false); setEditedKinds([]); setEditedCheckpoints({ routine: false, arrival: false }); await onSaved(payload.reminder); }
      if (action === "activate_arrival") setArrivalConfirmed(false);
      setMessage(payload.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The message action failed."); }
    finally { setBusy(false); }
  }
  return <details className={styles.orderEditor} onToggle={(event) => setExpanded(event.currentTarget.open)}><summary>Delivery dates &amp; automatic messages</summary><div className={styles.editorBody}><fieldset disabled={busy} className={styles.editorFieldset}>
    <p className={styles.editorIntro}>Enter the Jumia dates. Renova fills in the customer’s name, order number, items, payment and daily countdown for you.</p>
    <MessageTabs kind={kind} onChange={setKind} />
    {kind === "routine" ? <section className={styles.jumiaDates} aria-label="Jumia expected delivery dates">
      <h3>When does Jumia expect to deliver?</h3>
      <div className={styles.jumiaDateFields}>
        <label className={styles.field}><span>Expected from</span><input type="date" value={jumiaFrom} onChange={(event) => { setJumiaFrom(event.target.value); setDatesEdited(true); changed(); }} /></label>
        <label className={styles.field}><span>Expected to (optional for one date)</span><input type="date" min={jumiaFrom || undefined} value={jumiaTo} onChange={(event) => { setJumiaTo(event.target.value); setDatesEdited(true); changed(); }} /></label>
      </div>
      {dateError && <p role="alert" className={styles.dateWarning}>{dateError}</p>}
      {countdown && <p className={countdown.state === "overdue" ? styles.dateWarning : styles.dateSummary}><b>{countdown.dateLabel}</b><br />{countdown.message}</p>}
      {!jumiaFrom && !jumiaTo && <p className={styles.editorHint}>Until you have Jumia’s dates, the ready-made reminder uses the order’s normal delivery estimate.</p>}
      <button type="button" className="button quiet" disabled={busy || (!jumiaFrom && !jumiaTo)} onClick={() => { setJumiaFrom(""); setJumiaTo(""); setDatesEdited(true); changed(); }}>Clear dates</button>
    </section> : <label className={styles.field}><span>Where is the parcel ready for collection?</span><textarea rows={3} maxLength={500} value={arrivalCheckpoint} onChange={(event) => { setArrivalCheckpoint(event.target.value); setEditedCheckpoints((current) => ({ ...current, arrival: true })); changed(); }} placeholder="Enter the verified collection point or arrival details" /><small>The arrival message is already prepared. Add the confirmed collection information here.</small></label>}
    {kind === "arrival" && dateError && <p role="alert" className={styles.dateWarning}>Please correct the delivery dates in the Daily delivery update tab before saving.</p>}
    <section className={styles.automaticPreview} aria-label="Automatic customer message">
      <div className={styles.previewHeading}><b>{kind === "routine" ? "The daily message your customer will receive" : "The arrival message your customer will receive"}</b><span>WhatsApp preview</span></div>
      {dateError ? <p>Choose valid delivery dates to see the updated message.</p> : previewError ? <p role="alert">{previewError} Close and reopen this section to retry.</p> : previews ? <><p className={styles.customerMessage}>{kind === "routine" ? previews.preview : previews.arrivalPreview}</p><small>Prepared with this customer’s details. The days remaining update automatically each day.</small></> : <p className={styles.previewLoading} role="status">{expanded ? "Preparing the complete message for this customer…" : "Open this section to see the complete message for this customer."}</p>}
    </section>
    <div className={styles.editorActions}><button type="button" className="button primary" disabled={busy || Boolean(dateError)} onClick={() => void act("save_message_edits")}>{busy ? "Saving…" : "Save changes"}</button><small>Daily reminders continue automatically. Saving does not send an extra message.</small></div>
    {message && <p role="status" className={styles.controlMessage}>{message}</p>}
    {kind === "arrival" && <div className={styles.arrivalStart}>
      {reminder?.reminderPhase === "arrival" ? <p>Arrival reminders are selected. They continue every 24 hours through the channels that are on, until stopped or collected.</p> : <><label className={styles.consent}><input type="checkbox" checked={arrivalConfirmed} onChange={(event) => setArrivalConfirmed(event.target.checked)} /><span>I have verified with the courier that this parcel has arrived or is ready for collection.</span></label><button type="button" className="button primary" disabled={busy || Boolean(dateError) || !arrivalConfirmed || !arrivalCheckpoint.trim()} onClick={() => void act("activate_arrival")}>{reminder?.active ? "Confirm arrival and start arrival reminders" : "Record arrival; keep notifications off"}</button></>}
    </div>}
    <details className={styles.optionalWording}><summary>Optional: customise the wording</summary>
      <p>You can leave this closed. The complete message above is already prepared.</p>
      <MessageFields prefix={`order-${order.id}`} kind={kind} config={config} jumiaWindowActive={Boolean(jumiaFrom && !dateError)} onChange={(field, value) => { setOverrides((current) => ({ ...current, [kind]: { ...current[kind], [field]: value } })); setEditedKinds((current) => current.includes(kind) ? current : [...current, kind]); changed(); }} />
      {kind === "routine" && <label className={styles.field}><span>Optional verified courier update</span><textarea rows={2} maxLength={500} value={checkpoint} onChange={(event) => { setCheckpoint(event.target.value); setEditedCheckpoints((current) => ({ ...current, routine: true })); changed(); }} placeholder="Only if you have additional confirmed courier information" /></label>}
      <button type="button" className="button quiet" disabled={busy} onClick={() => { setOverrides((current) => ({ ...current, [kind]: null })); setEditedKinds((current) => current.includes(kind) ? current : [...current, kind]); changed(); }}>Use store default for this message</button>
      <p className={styles.editorHint}>Use Save changes above to keep any wording edits.</p>
    </details>
    {previews && <details className={styles.optionalWording}><summary>View the other messages, email and SMS</summary><div className={styles.editorPreviews}>
      <div className={styles.preview}><b>1. Order confirmation</b><small>Sent automatically when the order is confirmed. The Jumia dates do not change it.</small><p>{previews.confirmationPreview}</p></div>
      <div className={styles.preview}><b>{kind === "routine" ? "3. Arrival and collection reminder" : "2. Daily delivery update"}</b><small>{kind === "routine" ? "Starts only after you confirm the parcel has arrived." : "Uses the current expected delivery window."}</small><p>{kind === "routine" ? previews.arrivalPreview : previews.preview}</p></div>
      {previews.previewNigeriaDate && <small>Preview date in Nigeria: {previews.previewNigeriaDate}</small>}
      {(["routine", "arrival"] as const).map((value) => <div className={styles.preview} key={value}><b>{titleFor(value)}</b><p><b>Email subject:</b> {previews.emailPreviews[value].subject}</p><p><b>Email heading:</b> {previews.emailPreviews[value].heading}</p><p>{previews.emailPreviews[value].message}</p><p>{previews.emailPreviews[value].estimate}</p><p>{previews.emailPreviews[value].note}</p><hr /><b>SMS</b><p>{previews.smsPreviews[value]}</p></div>)}
    </div></details>}
  </fieldset></div></details>;
}
