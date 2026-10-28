"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import {
  DEFAULT_REMINDER_MESSAGES, MESSAGE_FIELD_LIMITS, mergeReminderMessageOverrides,
  parseMessageOverrides, resolveReminderMessage, resolveReminderMessageDraft, validateMessageOverrides,
  type EditableMessageKind, type MessageDefaults, type MessageOverrides,
  type ReminderMessageConfig, type ReminderMessageSource,
} from "../lib/reminder-message-content";
import { cleanMessageText, reminderMessageFields, whatsappPreview, whatsappTemplateParameters } from "../lib/whatsapp-message";
import { deliveryDaysRemaining, jumiaDeliveryCountdown, nigeriaCalendarDate, validateJumiaDeliveryWindow } from "../lib/jumia-delivery-countdown";
import styles from "./customer-reminder-bot.module.css";

export type MessageEditorReminder = ReminderMessageSource & {
  id: number; orderId: number; active: boolean; consentConfirmed: boolean;
  emailEnabled: boolean; whatsappEnabled: boolean; smsEnabled: boolean;
  currentCheckpoint: string; deliveryEstimate: string; customerNote: string;
  nextSendAt?: string | null; lastSentAt?: string | null;
};
type EditorOrder = { id: number; orderNumber: string; customerName: string };
export type MessageStep = "confirmation" | EditableMessageKind;
type PreviewChannel = "whatsapp" | "email" | "sms";
type EmailPreview = { message: string; estimate: string; note: string; subject: string; heading: string };
export type ReminderPreviewPayload = {
  previewNigeriaDate?: string; confirmationPreview: string; preview: string; arrivalPreview: string;
  emailPreviews: Record<EditableMessageKind, EmailPreview>;
  smsPreviews: Record<EditableMessageKind, string>;
  messageEditors?: Record<EditableMessageKind, { body: string; estimate: string; maxLength: number }>;
};
const steps: Array<{ value: MessageStep; title: string; description: string }> = [
  { value: "confirmation", title: "Order confirmation", description: "Automatic after the order is confirmed" },
  { value: "routine", title: "Daily delivery update", description: "Editable wording · automatic countdown" },
  { value: "arrival", title: "Arrival & collection", description: "Starts after you confirm arrival" },
];
const dateLabel = (date: Date) => date.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "long", year: "numeric" });

async function messageAction(body: object) {
  const response = await fetch("/api/orders/reminders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "The message settings could not be saved.");
  return payload;
}

function MessageTabs({ step, onChange, prefix, dirty }: {
  step: MessageStep; onChange: (value: MessageStep) => void; prefix: string; dirty?: Record<EditableMessageKind, boolean>;
}) {
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % steps.length : event.key === "ArrowLeft" ? (index + steps.length - 1) % steps.length : event.key === "Home" ? 0 : event.key === "End" ? steps.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); onChange(steps[next].value);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  return <div className={styles.workspaceTabs} role="tablist" aria-label="Order messages">{steps.map((item, index) => <button
    type="button" role="tab" key={item.value} id={`${prefix}-tab-${item.value}`}
    aria-selected={step === item.value} aria-controls={`${prefix}-panel-${item.value}`}
    tabIndex={step === item.value ? 0 : -1} onClick={() => onChange(item.value)} onKeyDown={(event) => move(event, index)}>
    <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
    <span><b>{item.title}{item.value !== "confirmation" && dirty?.[item.value] && <i className={styles.draftDot} aria-label="Unsaved changes" />}</b><small>{item.description}</small></span>
  </button>)}</div>;
}

function WordingFields({ kind, config, channel, hasDates, onField, onReset, prefix, resetLabel = "Use store default wording", settingsOnly = false }: {
  kind: EditableMessageKind; config: ReminderMessageConfig; channel: PreviewChannel; hasDates: boolean;
  onField: (field: keyof ReminderMessageConfig, value: string) => void; onReset: () => void; prefix: string; resetLabel?: string; settingsOnly?: boolean;
}) {
  return <section className={styles.workspaceCard} aria-label={kind === "routine" ? "Edit daily message" : "Edit arrival message"}>
    <div className={styles.cardTitle}><h3>{kind === "routine" ? "Daily message" : "Arrival message"}{settingsOnly ? " settings" : ""}</h3><span className={styles.editableTag}>Editable</span></div>
    {settingsOnly ? <p className={styles.workspaceHint}>Type directly in the customer message editor. Its wording, item list and payment amount are editable. Delivery dates and the days remaining stay automatic.</p> : <><label className={styles.workspaceField}><span>{kind === "routine" ? "Your message to the customer" : "Your arrival message to the customer"}</span>
      <textarea id={`${prefix}-message`} rows={5} maxLength={MESSAGE_FIELD_LIMITS.message} value={config.message} onChange={(event) => onField("message", event.target.value)} />
      <small>{config.message.length}/{MESSAGE_FIELD_LIMITS.message}. The name, order details and daily countdown are filled in automatically.</small>
    </label>
    <label className={styles.workspaceField}><span>Additional instructions <em>Optional</em></span><textarea rows={2} maxLength={MESSAGE_FIELD_LIMITS.note} value={config.note} onChange={(event) => onField("note", event.target.value)} placeholder="For example, have your collection code ready" /></label></>}
    {(kind === "arrival" || !hasDates) && <label className={styles.workspaceField}><span>{kind === "arrival" ? "Collection information line" : "Delivery estimate before Jumia dates are available"}</span><input maxLength={MESSAGE_FIELD_LIMITS.deliveryEstimate} value={config.deliveryEstimate} onChange={(event) => onField("deliveryEstimate", event.target.value)} placeholder={kind === "arrival" ? "Ready for collection now" : "Leave blank for the normal regional estimate"} /></label>}
    {channel === "email" && <div className={styles.emailWording}>
      <label className={styles.workspaceField}><span>Email subject</span><input maxLength={MESSAGE_FIELD_LIMITS.emailSubject} value={config.emailSubject} onChange={(event) => onField("emailSubject", event.target.value)} /></label>
      <label className={styles.workspaceField}><span>Email heading</span><input maxLength={MESSAGE_FIELD_LIMITS.emailHeading} value={config.emailHeading} onChange={(event) => onField("emailHeading", event.target.value)} /></label>
    </div>}
    <button type="button" className={styles.textButton} onClick={onReset}>{resetLabel}</button>
  </section>;
}

function WhatsAppFormattedText({ text }: { text: string }) {
  return <>{text.split(/(\*[^*\n]+\*)/g).map((part, index) => /^\*[^*]+\*$/.test(part) ? <strong key={index}>{part.slice(1, -1)}</strong> : part)}</>;
}

function CustomerMessagePreview({ order, step, channel, onChannel, preview, error, invalid, onRetry, bodyDraft, onBody, estimateOverride }: {
  order: EditorOrder;
  step: MessageStep; channel: PreviewChannel; onChannel: (value: PreviewChannel) => void;
  preview?: ReminderPreviewPayload; error?: string; invalid?: string; onRetry: () => void;
  bodyDraft?: string; onBody: (value: string) => void; estimateOverride?: string;
}) {
  const selectedChannel = step === "confirmation" ? "whatsapp" : channel;
  const email = step === "confirmation" ? undefined : preview?.emailPreviews[step];
  const whatsapp = step === "confirmation" ? preview?.confirmationPreview : step === "routine" ? preview?.preview : preview?.arrivalPreview;
  const editing = step !== "confirmation" && selectedChannel === "whatsapp";
  const editor = step === "confirmation" ? undefined : preview?.messageEditors?.[step];
  const body = bodyDraft ?? editor?.body ?? whatsapp?.split("\n\n")[2]?.replace(/\s*Reply STOP to stop WhatsApp updates\.$/, "");
  const estimate = estimateOverride ?? editor?.estimate ?? whatsapp?.split("\n\n")[3]?.replace(/^Expected delivery: /, "");
  return <aside className={styles.workspacePreview} aria-label="Customer message preview">
    <header><div><span className={styles.workspaceEyebrow}>Customer view</span><h3>{editing ? "Edit customer message" : "Message preview"}</h3></div><span className={editing ? styles.editableTag : styles.liveTag}>{editing ? "Type directly below" : "Automatic details"}</span></header>
    {step !== "confirmation" && <div className={styles.previewChannels} aria-label="Preview channel">{(["whatsapp", "email", "sms"] as const).map((value) => <button type="button" key={value} aria-pressed={channel === value} onClick={() => onChannel(value)}>{value === "whatsapp" ? "WhatsApp" : value === "email" ? "Email" : "SMS"}</button>)}</div>}
    <div className={styles.previewPaper}>
      {editing ? <div className={styles.fullMessageEditor}>
        <p>Hello {cleanMessageText(order.customerName.trim().split(/\s+/)[0] || "there", 40)},</p>
        <p>Here is the latest update for your Renova order {cleanMessageText(order.orderNumber, 64)}:</p>
        <label className={styles.fullMessageField}><span>{step === "routine" ? "Daily message including items and amount" : "Arrival message including items and amount"}</span>
          <textarea id={`order-${order.id}-messages-${step}-full-message`} rows={10} maxLength={MESSAGE_FIELD_LIMITS.fullMessage} value={body ?? ""} disabled={body === undefined} aria-invalid={Boolean(invalid || error)} onChange={(event) => onBody(event.target.value)} placeholder="Preparing the complete message…" />
          <small>{body?.length ?? 0}/{editor?.maxLength ?? MESSAGE_FIELD_LIMITS.fullMessage} characters. Edit the wording, quantities, products and amount here.</small>
        </label>
        {step === "arrival" && <p className={styles.arrivalOptOut}>Reply STOP to stop WhatsApp updates.</p>}
        <div className={styles.automaticDeliveryLine}><span className={styles.liveTag}>Updates automatically</span><p>Expected delivery: <WhatsAppFormattedText text={estimate || "Preparing delivery estimate…"} /></p></div>
        <p>Please keep your phone available so the courier can reach you. You do not need to place another order.</p>
        <p>Thank you for shopping with Renova.</p>
        {(invalid || error) && <p role="alert" className={styles.workspaceError}>{invalid || error}</p>}
        {!preview && !error && <small role="status">Updating the outgoing preview…</small>}
      </div> : invalid ? <p className={styles.previewPlaceholder}>Complete the message fields to update this preview.</p> : error ? <div role="alert"><p>{error}</p><button type="button" className={styles.textButton} onClick={onRetry}>Reload preview</button></div> : !preview ? <p role="status" className={styles.previewPlaceholder}>Preparing this customer’s complete message…</p> : selectedChannel === "whatsapp" ? <p className={styles.customerMessage}><WhatsAppFormattedText text={whatsapp || ""} /></p> : selectedChannel === "sms" && step !== "confirmation" ? <p className={styles.customerMessage}>{preview.smsPreviews[step]}</p> : email && <div className={styles.emailMessage}><small>Subject: {email.subject}</small><h4>{email.heading}</h4><p>{email.message}</p><p><b>Expected delivery:</b> {email.estimate}</p><p>{email.note}</p></div>}
    </div>
    <footer>{step === "confirmation" ? "Automatic for new confirmed orders. Previewing does not resend it." : <><span>Saving changes this reminder only; it does not change the order total or payment records and does not send an extra message.</span><span>The greeting and closing follow your approved WhatsApp template. Dates and countdown update automatically.</span></>}{preview?.previewNigeriaDate && <span>Calculated for {preview.previewNigeriaDate} · Nigeria time</span>}</footer>
  </aside>;
}

type WorkspaceActions = {
  toggle: (open: boolean) => void; step: (value: MessageStep) => void; channel: (value: PreviewChannel) => void;
  date: (field: "from" | "to", value: string) => void; clearDates: () => void;
  field: (field: keyof ReminderMessageConfig, value: string) => void; checkpoint: (value: string) => void;
  body: (value: string) => void;
  arrivalCheckpoint: (value: string) => void; arrivalConfirmed: (value: boolean) => void;
  reset: () => void; save: () => void; activateArrival: () => void; retryPreview: () => void;
};
export type OrderMessageWorkspaceProps = {
  order: EditorOrder; reminder?: MessageEditorReminder; expanded: boolean; step: MessageStep; channel: PreviewChannel;
  configs: MessageDefaults; dates: { from: string; to: string; error?: string }; clock: Date | null;
  checkpoint: string; arrivalCheckpoint: string; arrivalConfirmed: boolean;
  dirty: Record<EditableMessageKind, boolean>; validationError?: string; busy: boolean; feedback: string;
  preview?: ReminderPreviewPayload; previewError?: string; actions: WorkspaceActions;
  bodyDraft?: string;
};

export function OrderMessageWorkspace(props: OrderMessageWorkspaceProps) {
  const { order, reminder, expanded, step, channel, configs, dates, clock, checkpoint, arrivalCheckpoint, arrivalConfirmed, dirty, validationError, busy, feedback, preview, previewError, actions } = props;
  const prefix = `order-${order.id}-messages`;
  const source = { jumiaDeliveryFrom: dates.from || null, jumiaDeliveryTo: dates.to || dates.from || null };
  const countdown = clock && !dates.error ? jumiaDeliveryCountdown(source, clock) : null;
  const tomorrow = clock ? new Date(clock.getTime() + 86_400_000) : null;
  const nextCountdown = tomorrow && !dates.error ? jumiaDeliveryCountdown(source, tomorrow) : null;
  const invalid = step === "confirmation" ? undefined : validationError || (step === "routine" ? dates.error : undefined);
  return <details className={styles.orderEditor} open={expanded} onToggle={(event) => actions.toggle(event.currentTarget.open)}>
    <summary>Delivery dates &amp; automatic messages</summary>
    <div className={styles.messageWorkspace}>
      <header className={styles.workspaceHeader}><div><span className={styles.workspaceEyebrow}>Three messages, one order</span><h2>Customer messages</h2><p>Review the confirmation, edit the daily update, and manage arrival reminders.</p></div></header>
      <MessageTabs step={step} onChange={actions.step} prefix={prefix} dirty={dirty} />
      {steps.map((item) => <section key={item.value} role="tabpanel" id={`${prefix}-panel-${item.value}`} aria-labelledby={`${prefix}-tab-${item.value}`} hidden={step !== item.value} tabIndex={0}>
        {step === item.value && <fieldset disabled={busy} className={styles.editorFieldset}>
          <div className={styles.workspaceGrid}>
            <div className={styles.workspaceForm}>
              {step === "confirmation" ? <section className={styles.workspaceCard}>
                <div className={styles.cardTitle}><h3>Order confirmation</h3><span className={styles.liveTag}>Automatic</span></div>
                <p>This first message is sent automatically for new orders after confirmation or verified payment.</p>
                <ul className={styles.confirmationFacts}><li>Thanks the customer and confirms receipt of the order.</li><li>Includes their name, order number, items and payment details.</li><li>Keeps the website’s regional delivery estimate.</li></ul>
                <p className={styles.workspaceHint}>Daily wording and Jumia date changes do not change this confirmation.</p>
              </section> : <>
                <WordingFields kind={step} config={configs[step]} channel={channel} hasDates={Boolean(dates.from && !dates.error)} prefix={`${prefix}-${step}`} onField={actions.field} onReset={actions.reset} resetLabel="Restore automatic message and order details" settingsOnly />
                {step === "routine" ? <section className={styles.workspaceCard} aria-label="Jumia expected delivery dates">
                  <div className={styles.cardTitle}><h3>Jumia delivery dates</h3><span className={styles.liveTag}>Daily countdown</span></div>
                  <p className={styles.workspaceHint}>Enter the window Jumia gives you after placing the supplier order.</p>
                  <div className={styles.workspaceDateFields}>
                    <label className={styles.workspaceField}><span>Expected from</span><input type="date" value={dates.from} onChange={(event) => actions.date("from", event.target.value)} /></label>
                    <label className={styles.workspaceField}><span>Expected to <em>Optional</em></span><input type="date" min={dates.from || undefined} value={dates.to} onChange={(event) => actions.date("to", event.target.value)} /></label>
                  </div>
                  {dates.error && <p role="alert" className={styles.workspaceError}>{dates.error}</p>}
                  {countdown && <div className={styles.countdownSchedule} aria-label="Automatic daily countdown"><div><span>Today{clock ? ` · ${dateLabel(clock)}` : ""}</span><b>{deliveryDaysRemaining(countdown)}</b></div>{nextCountdown && <div><span>Tomorrow{tomorrow ? ` · ${dateLabel(tomorrow)}` : ""}</span><b>{deliveryDaysRemaining(nextCountdown)}</b></div>}<small>Renova recalculates the days remaining for every scheduled message. You do not need to edit the numbers.</small></div>}
                  {!dates.from && !dates.to && <p className={styles.workspaceHint}>Until Jumia’s dates are available, the reminder uses the order’s normal delivery estimate.</p>}
                  <button type="button" className={styles.textButton} disabled={!dates.from && !dates.to} onClick={actions.clearDates}>Clear delivery dates</button>
                </section> : <section className={styles.workspaceCard}>
                  <div className={styles.cardTitle}><h3>Collection details</h3><span className={styles.liveTag}>Verified by you</span></div>
                  <label className={styles.workspaceField}><span>Where is the parcel ready for collection?</span><textarea rows={3} maxLength={500} value={arrivalCheckpoint} onChange={(event) => actions.arrivalCheckpoint(event.target.value)} placeholder="Collection point, address or confirmed arrival information" /></label>
                  <p className={styles.workspaceHint}>Reaching the expected date does not confirm arrival. Enter the courier’s verified information here.</p>
                </section>}
                {step === "routine" && <section className={styles.workspaceCard}>
                  <label className={styles.workspaceField}><span>Verified courier update <em>Optional</em></span><textarea rows={2} maxLength={500} value={checkpoint} onChange={(event) => actions.checkpoint(event.target.value)} placeholder="Add a confirmed courier update if you have one" /></label>
                </section>}
                {invalid && <p role="alert" className={styles.workspaceError}>{invalid}</p>}
                <div className={styles.workspaceSave}><button type="button" className="button primary" disabled={busy || Boolean(invalid) || !dirty[step]} onClick={actions.save}>{busy ? "Saving…" : step === "routine" ? "Save daily update" : "Save arrival wording"}</button><span>{dirty[step] ? "Unsaved changes" : "Saved"}<small>Saving keeps the current sending schedule.</small></span></div>
                {step === "arrival" && <section className={styles.arrivalStart}>
                  <h3>Start arrival reminders</h3>
                  {reminder?.reminderPhase === "arrival" ? <p>Arrival reminders are selected. They continue every 24 hours while enabled, until stopped or collected.</p> : <><label className={styles.consent}><input type="checkbox" checked={arrivalConfirmed} onChange={(event) => actions.arrivalConfirmed(event.target.checked)} /><span>I have verified with the courier that this parcel has arrived or is ready for collection.</span></label><button type="button" className="button primary" disabled={busy || Boolean(invalid) || !arrivalConfirmed || !arrivalCheckpoint.trim()} onClick={actions.activateArrival}>{reminder?.active ? "Confirm arrival and start arrival reminders" : "Record arrival; keep notifications off"}</button></>}
                </section>}
              </>}
              {feedback && <p role="status" className={styles.workspaceFeedback}>{feedback}</p>}
            </div>
            <CustomerMessagePreview order={order} step={step} channel={channel} onChannel={actions.channel} preview={preview} error={previewError} invalid={invalid} onRetry={actions.retryPreview} bodyDraft={props.bodyDraft} onBody={actions.body} estimateOverride={step === "routine" && countdown ? `${countdown.dateLabel} · *${deliveryDaysRemaining(countdown)}*` : undefined} />
          </div>
        </fieldset>}
      </section>)}
    </div>
  </details>;
}

export function StoreReminderMessageDefaults({ defaults, onSaved }: { defaults: MessageDefaults; onSaved: (defaults: MessageDefaults) => void }) {
  const [draft, setDraft] = useState<MessageDefaults>(() => ({ routine: resolveReminderMessage("routine", {}, defaults), arrival: resolveReminderMessage("arrival", {}, defaults) }));
  const [kind, setKind] = useState<EditableMessageKind>("routine");
  const [channel, setChannel] = useState<PreviewChannel>("whatsapp");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const sample = { customerName: "Sample Customer", orderNumber: "PREVIEW-ONLY", customerPhone: "", status: "dispatched", paymentMethod: "cash_on_delivery", paymentStatus: "payment_due_on_delivery", totalKobo: 2450000, itemsJson: '[{"name":"Sample product","quantity":1}]', addressJson: '{"stateCode":"LA"}', estimatedDelivery: "3–5 working days" };
  let error = "";
  try { validateMessageOverrides(draft); } catch (cause) { error = cause instanceof Error ? cause.message : "Check the message fields."; }
  async function save() {
    setBusy(true); setFeedback("");
    try { const result = await messageAction({ action: "save_message_defaults", messageDefaults: draft }); onSaved(result.messageDefaults); setDraft(result.messageDefaults); setFeedback(result.message); }
    catch (cause) { setFeedback(cause instanceof Error ? cause.message : "Could not save the defaults."); }
    finally { setBusy(false); }
  }
  const sampleReminder = { currentCheckpoint: "", customerNote: "", deliveryEstimate: "", arrivalCheckpoint: kind === "arrival" ? "Sample collection point. Please bring your collection code." : "" };
  const sampleFields = reminderMessageFields(sample, sampleReminder, kind, draft);
  return <details className={styles.storeDefaults}><summary>Store message defaults</summary><div className={styles.messageWorkspace}><fieldset disabled={busy} className={styles.editorFieldset}>
    <p className={styles.workspaceHint}>Set the wording for orders without a custom message. Customer details and the daily countdown stay automatic. The first confirmation stays separate.</p>
    <div className={styles.defaultsTabs}>{(["routine", "arrival"] as const).map((value) => <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>{value === "routine" ? "Daily update" : "Arrival reminder"}</button>)}<button type="button" className={styles.textButton} onClick={() => setChannel(channel === "email" ? "whatsapp" : "email")}>{channel === "email" ? "WhatsApp fields" : "Email subject & heading"}</button></div>
    <div className={styles.workspaceGrid}>
      <WordingFields kind={kind} config={draft[kind]} channel={channel} hasDates={false} prefix="store-default" resetLabel="Restore original wording" onField={(field, value) => setDraft((current) => ({ ...current, [kind]: { ...current[kind], [field]: value } }))} onReset={() => setDraft((current) => ({ ...current, [kind]: { ...DEFAULT_REMINDER_MESSAGES[kind] } }))} />
      <div className={styles.workspacePreview}><header><h3>Example preview</h3></header><div className={styles.previewPaper}>{channel === "email" ? <div className={styles.emailMessage}><small>Subject: {sampleFields.subject}</small><h4>{sampleFields.heading}</h4><p>{sampleFields.message}</p><p><b>Expected delivery:</b> {sampleFields.estimate}</p><p>{sampleFields.note}</p></div> : <p className={styles.customerMessage}>{whatsappPreview(whatsappTemplateParameters(sample, sampleReminder, kind, draft))}</p>}</div><footer>Uses the approved Meta template. Example only; nothing is sent.</footer></div>
    </div>
    {error && <p role="alert" className={styles.workspaceError}>{error}</p>}
    <div className={styles.workspaceSave}><button type="button" className="button primary" disabled={busy || Boolean(error)} onClick={() => void save()}>Save default messages</button></div>{feedback && <p role="status" className={styles.workspaceFeedback}>{feedback}</p>}
  </fieldset></div></details>;
}

export function OrderReminderMessageEditor({ order, reminder, defaults, onSaved }: { order: EditorOrder; reminder?: MessageEditorReminder; defaults: MessageDefaults; onSaved: (reminder: MessageEditorReminder) => void | Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState<MessageStep>(reminder?.reminderPhase === "arrival" ? "arrival" : "routine");
  const [channel, setChannel] = useState<PreviewChannel>("whatsapp");
  const [edits, setEdits] = useState<MessageOverrides>({});
  const [dateDraft, setDateDraft] = useState<{ from: string; to: string } | null>(null);
  const [checkpointDraft, setCheckpointDraft] = useState<string | null>(null);
  const [arrivalDraft, setArrivalDraft] = useState<string | null>(null);
  const [arrivalConfirmed, setArrivalConfirmed] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [revision, setRevision] = useState(0);
  const [previewResult, setPreviewResult] = useState<{ key: string; payload?: ReminderPreviewPayload; error?: string } | null>(null);
  useEffect(() => {
    const tick = () => setClock((previous) => { const current = new Date(); return previous && nigeriaCalendarDate(previous) === nigeriaCalendarDate(current) ? previous : current; });
    const visible = () => { if (document.visibilityState === "visible") tick(); };
    const first = setTimeout(tick, 0), timer = setInterval(tick, 60_000);
    window.addEventListener("focus", tick); document.addEventListener("visibilitychange", visible);
    return () => { clearTimeout(first); clearInterval(timer); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", visible); };
  }, []);
  const dates = dateDraft || { from: reminder?.jumiaDeliveryFrom || "", to: reminder?.jumiaDeliveryTo || "" };
  const checkpoint = checkpointDraft ?? reminder?.currentCheckpoint ?? "";
  const arrivalCheckpoint = arrivalDraft ?? reminder?.arrivalCheckpoint ?? "";
  const overrides = mergeReminderMessageOverrides(parseMessageOverrides(reminder?.messageOverridesJson), edits);
  const configs = { routine: resolveReminderMessageDraft("routine", reminder || {}, defaults, edits), arrival: resolveReminderMessageDraft("arrival", reminder || {}, defaults, edits) };
  let dateError = "", validationError = "";
  try { validateJumiaDeliveryWindow(dates); } catch (cause) { dateError = cause instanceof Error ? cause.message : "Check the delivery dates."; }
  if (step !== "confirmation" && Object.hasOwn(edits, step)) try { validateMessageOverrides({ [step]: edits[step] }); } catch (cause) { validationError = cause instanceof Error ? cause.message : "Check the message fields."; }
  const dirty = { routine: Object.hasOwn(edits, "routine") || dateDraft !== null || checkpointDraft !== null, arrival: Object.hasOwn(edits, "arrival") || arrivalDraft !== null };
  const previewBody = JSON.stringify({ action: "preview", orderId: order.id, ...(step !== "confirmation" ? { messageOverrides: { [step]: overrides[step] }, ...(step === "routine" ? { currentCheckpoint: checkpoint, jumiaDeliveryWindow: dates } : { arrivalCheckpoint }) } : {}) });
  const previewDay = clock ? nigeriaCalendarDate(clock) : "";
  const previewKey = `${step}:${previewDay}:${revision}:${previewBody}:${JSON.stringify(defaults)}:${JSON.stringify(order)}`;
  const preview = previewResult?.key === previewKey ? previewResult.payload : undefined;
  const previewError = previewResult?.key === previewKey ? previewResult.error : undefined;
  const invalidPreview = step === "confirmation" ? "" : validationError || (step === "routine" ? dateError : "");
  useEffect(() => {
    if (!expanded || !previewDay || invalidPreview) return;
    const controller = new AbortController(); let current = true;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/orders/reminders", { method: "POST", headers: { "content-type": "application/json" }, body: previewBody, signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load this message preview.");
        if (current) setPreviewResult({ key: previewKey, payload });
      } catch (cause) { if (current && !controller.signal.aborted) setPreviewResult({ key: previewKey, error: cause instanceof Error ? cause.message : "Could not load the preview." }); }
    }, 200);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [expanded, previewDay, invalidPreview, previewBody, previewKey]);
  function changeField(field: keyof ReminderMessageConfig, value: string) {
    if (step === "confirmation") return;
    setEdits((current) => ({ ...current, [step]: { ...(current[step] === null ? configs[step] : current[step]), [field]: value } })); setFeedback("");
  }
  async function save(activateArrival = false) {
    if (step === "confirmation") return;
    const kind = step;
    setBusy(true); setFeedback("");
    try {
      const payload = await messageAction({ action: activateArrival ? "activate_arrival" : "save_message_edits", orderId: order.id,
        messageOverrides: Object.hasOwn(edits, kind) ? { [kind]: edits[kind] } : {},
        ...(kind === "routine" && dateDraft ? { jumiaDeliveryWindow: dateDraft } : {}),
        ...(kind === "routine" && checkpointDraft !== null ? { currentCheckpoint: checkpoint } : {}),
        ...(kind === "arrival" && (arrivalDraft !== null || activateArrival) ? { arrivalCheckpoint } : {}),
        ...(activateArrival ? { arrivalConfirmed } : {}),
      });
      if (payload.reminder) {
        await onSaved(payload.reminder);
        const savedBody = edits[kind]?.fullMessage;
        if (savedBody !== undefined) setPreviewResult((current) => current?.payload ? { ...current, payload: { ...current.payload,
          messageEditors: { routine: current.payload.messageEditors?.routine || { body: "", estimate: "", maxLength: 700 }, arrival: current.payload.messageEditors?.arrival || { body: "", estimate: "", maxLength: 700 },
            [kind]: { ...(current.payload.messageEditors?.[kind] || { estimate: "", maxLength: 700 }), body: cleanMessageText(savedBody, Number.MAX_SAFE_INTEGER) } },
        } } : current);
        setEdits((current) => { const next = { ...current }; delete next[kind]; return next; });
        if (kind === "routine") { setDateDraft(null); setCheckpointDraft(null); } else setArrivalDraft(null);
      }
      if (activateArrival) setArrivalConfirmed(false);
      setFeedback(payload.message); setRevision((current) => current + 1);
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : "The changes could not be saved."); }
    finally { setBusy(false); }
  }
  return <OrderMessageWorkspace order={order} reminder={reminder} expanded={expanded} step={step} channel={channel}
    configs={configs} dates={{ ...dates, error: dateError }} clock={clock} checkpoint={checkpoint} arrivalCheckpoint={arrivalCheckpoint}
    arrivalConfirmed={arrivalConfirmed} dirty={dirty} validationError={validationError} busy={busy} feedback={feedback}
    preview={preview || previewResult?.payload} previewError={previewError} bodyDraft={step === "confirmation" ? undefined : edits[step]?.fullMessage} actions={{
      toggle: setExpanded, step: (value) => { setStep(value); setFeedback(""); }, channel: setChannel,
      date: (field, value) => { setDateDraft({ ...dates, [field]: value }); setFeedback(""); },
      clearDates: () => { setDateDraft({ from: "", to: "" }); setFeedback(""); }, field: changeField,
      body: (value) => changeField("fullMessage", value),
      checkpoint: (value) => { setCheckpointDraft(value); setFeedback(""); }, arrivalCheckpoint: (value) => { setArrivalDraft(value); setFeedback(""); },
      arrivalConfirmed: setArrivalConfirmed, reset: () => { if (step !== "confirmation") setEdits((current) => ({ ...current, [step]: null })); setFeedback(""); },
      save: () => void save(), activateArrival: () => void save(true), retryPreview: () => setRevision((current) => current + 1),
    }} />;
}
