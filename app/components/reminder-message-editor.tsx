"use client";

import { useEffect, useState } from "react";
import { DEFAULT_REMINDER_MESSAGES, MESSAGE_FIELD_LIMITS, MESSAGE_VARIABLES, parseMessageOverrides, resolveReminderMessage, type EditableMessageKind, type MessageDefaults, type MessageOverrides, type ReminderMessageConfig, type ReminderMessageSource } from "../lib/reminder-message-content";
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
    <label className={styles.field}><span>{kind === "routine" ? "Daily message" : "Arrival reminder message"}</span><textarea id={`${prefix}-message`} rows={4} maxLength={MESSAGE_FIELD_LIMITS.message} value={config.message} onChange={(event) => onChange("message", event.target.value)} /><small>{config.message.length}/{MESSAGE_FIELD_LIMITS.message} characters. Items, payment amount and WhatsApp STOP instructions are added automatically.</small></label>
    <div className={styles.variables} aria-label="Insert an order detail">{MESSAGE_VARIABLES.map((variable) => <button type="button" key={variable} disabled={config.message.length + variable.length + 5 > MESSAGE_FIELD_LIMITS.message} onClick={() => onChange("message", `${config.message}${config.message.endsWith(" ") ? "" : " "}{{${variable}}}`)}>{variable.replaceAll("_", " ")}</button>)}</div>
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
  const [preview, setPreview] = useState(false);
  const sample = { customerName: "Sample Customer", orderNumber: "PREVIEW-ONLY", customerPhone: "", status: "dispatched", paymentMethod: "cash_on_delivery", paymentStatus: "payment_due_on_delivery", totalKobo: 2450000, itemsJson: '[{"name":"Sample product","quantity":1}]', addressJson: '{"stateCode":"LA"}', estimatedDelivery: "3–5 working days" };
  async function save() {
    setBusy(true); setMessage("");
    try { const result = await messageAction({ action: "save_message_defaults", messageDefaults: draft }); onSaved(result.messageDefaults); setDraft(result.messageDefaults); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save defaults."); }
    finally { setBusy(false); }
  }
  return <details className={styles.storeDefaults}><summary>Edit default daily and arrival messages</summary><div className={styles.editorBody}><fieldset disabled={busy} className={styles.editorFieldset}>
    <p>Use these for orders without a custom message. Per-order edits and existing delivery notes stay with their orders. The first order confirmation stays separate.</p>
    <MessageTabs kind={kind} onChange={setKind} />
    <MessageFields prefix="store-default" kind={kind} config={draft[kind]} onChange={(field, value) => { setDraft((current) => ({ ...current, [kind]: { ...current[kind], [field]: value } })); setPreview(false); }} />
    <div className={styles.editorActions}><button type="button" className="button primary" disabled={busy} onClick={() => void save()}>Save default messages</button><button type="button" className="button quiet" disabled={busy} onClick={() => setPreview(true)}>Preview example</button><button type="button" className="button quiet" disabled={busy} onClick={() => { setDraft((current) => ({ ...current, [kind]: { ...DEFAULT_REMINDER_MESSAGES[kind] } })); setPreview(false); }}>Restore this original default</button></div>
    {message && <p role="status">{message}</p>}
    {preview && <div className={styles.preview}><b>Example only. Previewing sends nothing.</b><p>{whatsappPreview(whatsappTemplateParameters(sample, { currentCheckpoint: "", customerNote: "", deliveryEstimate: "", arrivalCheckpoint: kind === "arrival" ? "Sample collection point. Please bring your collection code." : "", reminderPhase: kind === "arrival" ? "arrival" : "delivery" }, kind, draft))}</p></div>}
    <p className={styles.editorHint}>WhatsApp uses the greeting and closing from your approved Meta template. The message section and delivery line above are editable. WhatsApp condenses line breaks and may shorten long expanded text; use the full preview before saving. Email and SMS use the same message wording. A Jumia countdown is added automatically for orders with saved Jumia dates.</p>
  </fieldset></div></details>;
}

export function OrderReminderMessageEditor({ order, reminder, defaults, onSaved }: { order: EditorOrder; reminder?: MessageEditorReminder; defaults: MessageDefaults; onSaved: (reminder: MessageEditorReminder) => void | Promise<void> }) {
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
  const [previews, setPreviews] = useState<PreviewPayload | null>(null);
  let dateError = "";
  let countdown: ReturnType<typeof jumiaDeliveryCountdown> = null;
  try { const dates = validateJumiaDeliveryWindow({ from: jumiaFrom, to: jumiaTo }); if (clock && dates.from) countdown = jumiaDeliveryCountdown({ jumiaDeliveryFrom: dates.from, jumiaDeliveryTo: dates.to }, clock); } catch (error) { dateError = error instanceof Error ? error.message : "Check the Jumia dates."; }
  const source = { ...reminder, jumiaDeliveryFrom: jumiaFrom || null, jumiaDeliveryTo: jumiaTo || jumiaFrom || null, currentCheckpoint: checkpoint, arrivalCheckpoint, messageOverridesJson: JSON.stringify(overrides) };
  const config = resolveReminderMessage(kind, source, defaults);
  function changed() { setPreviews(null); setMessage(""); }
  async function act(action: "save_message_edits" | "preview" | "activate_arrival") {
    setBusy(true); setMessage("");
    try {
      const payload = await messageAction({ action, orderId: order.id, messageOverrides: action === "preview" ? overrides : Object.fromEntries(editedKinds.map((value) => [value, overrides[value]])), ...(action === "preview" || editedCheckpoints.routine ? { currentCheckpoint: checkpoint } : {}), ...(action === "preview" || action === "activate_arrival" || editedCheckpoints.arrival ? { arrivalCheckpoint } : {}), arrivalConfirmed, ...(action === "preview" || datesEdited ? { jumiaDeliveryWindow: { from: jumiaFrom, to: jumiaTo } } : {}) });
      if (payload.reminder) { setOverrides(parseMessageOverrides(payload.reminder.messageOverridesJson)); setCheckpoint(payload.reminder.currentCheckpoint || ""); setArrivalCheckpoint(payload.reminder.arrivalCheckpoint || ""); setJumiaFrom(payload.reminder.jumiaDeliveryFrom || ""); setJumiaTo(payload.reminder.jumiaDeliveryTo || ""); setDatesEdited(false); setEditedKinds([]); setEditedCheckpoints({ routine: false, arrival: false }); await onSaved(payload.reminder); }
      if (action === "preview") setPreviews(payload);
      if (action === "activate_arrival") setArrivalConfirmed(false);
      setMessage(payload.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The message action failed."); }
    finally { setBusy(false); }
  }
  return <details className={styles.orderEditor}><summary>Edit messages for this order</summary><div className={styles.editorBody}><fieldset disabled={busy} className={styles.editorFieldset}>
    <p><b>1. Order confirmation</b> is automatic and separate from these edits.</p>
    <p>Current reminder: <b>{reminder?.reminderPhase === "arrival" ? "Arrival and collection" : "Daily delivery progress"}</b>. Saving wording leaves the sending schedule and on/off controls unchanged.</p>
    <MessageTabs kind={kind} onChange={setKind} />
    {kind === "routine" && <section className={styles.jumiaDates} aria-label="Jumia expected delivery dates">
      <h3>Jumia expected delivery dates</h3>
      <p>After placing the Jumia order, enter its delivery window here. The daily countdown recalculates using calendar days in Nigeria. These dates do not change the order confirmation.</p>
      <div className={styles.jumiaDateFields}>
        <label className={styles.field}><span>Expected from</span><input type="date" value={jumiaFrom} onChange={(event) => { setJumiaFrom(event.target.value); setDatesEdited(true); changed(); }} /></label>
        <label className={styles.field}><span>Expected to (optional for one date)</span><input type="date" min={jumiaFrom || undefined} value={jumiaTo} onChange={(event) => { setJumiaTo(event.target.value); setDatesEdited(true); changed(); }} /></label>
      </div>
      {dateError && <p role="alert" className={styles.dateWarning}>{dateError}</p>}
      {countdown && <div className={countdown.state === "overdue" ? styles.dateWarning : styles.countdownPreview} aria-live="polite"><b>{countdown.dateLabel}</b><p>{countdown.message}</p><small>Calculated for {clock?.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "long", year: "numeric" })}. Arrival still needs your confirmation.</small></div>}
      {!jumiaFrom && !jumiaTo && <p className={styles.editorHint}>No Jumia dates saved: daily updates use the normal delivery estimate and current order progress.</p>}
      <button type="button" className="button quiet" disabled={busy || (!jumiaFrom && !jumiaTo)} onClick={() => { setJumiaFrom(""); setJumiaTo(""); setDatesEdited(true); changed(); }}>Clear Jumia dates</button>
      <p className={styles.editorHint}>Save below to apply the dates. Saving sends nothing and keeps the current 24-hour schedule. COD reminders also ask the customer to keep their payment ready.</p>
    </section>}
    <MessageFields prefix={`order-${order.id}`} kind={kind} config={config} jumiaWindowActive={Boolean(jumiaFrom && !dateError)} onChange={(field, value) => { setOverrides((current) => ({ ...current, [kind]: { ...current[kind], [field]: value } })); setEditedKinds((current) => current.includes(kind) ? current : [...current, kind]); changed(); }} />
    <label className={styles.field}><span>{kind === "routine" ? "Verified courier progress for this order" : "Verified arrival or collection details for this order"}</span><textarea rows={3} maxLength={500} value={kind === "routine" ? checkpoint : arrivalCheckpoint} onChange={(event) => { if (kind === "routine") setCheckpoint(event.target.value); else setArrivalCheckpoint(event.target.value); setEditedCheckpoints((current) => ({ ...current, [kind]: true })); changed(); }} placeholder={kind === "routine" ? "Optional: the latest confirmed courier update" : "Collection point, address, collection code instructions or confirmed arrival information"} /></label>
    <div className={styles.editorActions}><button type="button" className="button primary" disabled={busy || Boolean(dateError)} onClick={() => void act("save_message_edits")}>{kind === "routine" ? "Save message & Jumia dates" : "Save message wording"}</button><button type="button" className="button quiet" disabled={busy || Boolean(dateError)} onClick={() => void act("preview")}>Preview all three messages</button><button type="button" className="button quiet" disabled={busy} onClick={() => { setOverrides((current) => ({ ...current, [kind]: null })); setEditedKinds((current) => current.includes(kind) ? current : [...current, kind]); changed(); }}>Use store default for this message</button></div>
    {kind === "arrival" && <div className={styles.arrivalStart}>
      {reminder?.reminderPhase === "arrival" ? <p>Arrival reminders are selected. They continue every 24 hours through the channels that are on, until stopped or collected.</p> : <><label className={styles.consent}><input type="checkbox" checked={arrivalConfirmed} onChange={(event) => setArrivalConfirmed(event.target.checked)} /><span>I have verified with the courier that this parcel has arrived or is ready for collection.</span></label><button type="button" className="button primary" disabled={busy || Boolean(dateError) || !arrivalConfirmed || !arrivalCheckpoint.trim()} onClick={() => void act("activate_arrival")}>{reminder?.active ? "Confirm arrival and start arrival reminders" : "Record arrival; keep notifications off"}</button></>}
    </div>}
    {message && <p role="status" className={styles.controlMessage}>{message}</p>}
    {previews && <div className={styles.editorPreviews}>
      {previews.previewNigeriaDate && <p>Preview date in Nigeria: {previews.previewNigeriaDate}. The countdown recalculates on each sending day.</p>}
      <div className={styles.preview}><b>1. Order confirmation</b><small>Automatic confirmation. Reminder edits do not change it.</small><p>{previews.confirmationPreview}</p></div>
      <div className={styles.preview}><b>2. Daily delivery update</b><p>{previews.preview}</p></div>
      <div className={styles.preview}><b>3. Arrival and collection reminder</b><small>Preview only. It will not start until you confirm arrival.</small><p>{previews.arrivalPreview}</p></div>
      <details className={styles.emailFields}><summary>Email and SMS previews</summary>{(["routine", "arrival"] as const).map((value) => <div className={styles.preview} key={value}><b>{titleFor(value)}</b><p><b>Email subject:</b> {previews.emailPreviews[value].subject}</p><p><b>Email heading:</b> {previews.emailPreviews[value].heading}</p><p>{previews.emailPreviews[value].message}</p><p>{previews.emailPreviews[value].estimate}</p><p>{previews.emailPreviews[value].note}</p><hr /><b>SMS</b><p>{previews.smsPreviews[value]}</p></div>)}</details>
    </div>}
    <p className={styles.editorHint}>The preview shows the full approved WhatsApp layout, including any shortening needed to fit it. Previewing and saving send nothing. Use the controls above to stop WhatsApp; the other channel controls are below.</p>
  </fieldset></div></details>;
}
