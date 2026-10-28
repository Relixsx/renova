export type EditableMessageKind = "routine" | "arrival";
export type ReminderMessageConfig = {
  message: string;
  deliveryEstimate: string;
  note: string;
  emailSubject: string;
  emailHeading: string;
};
export type MessageDefaults = Record<EditableMessageKind, ReminderMessageConfig>;
export type MessageOverrides = Partial<Record<EditableMessageKind, Partial<ReminderMessageConfig> | null>>;
export type ReminderMessageSource = {
  currentCheckpoint?: string;
  deliveryEstimate?: string;
  customerNote?: string;
  messageOverridesJson?: string;
  reminderPhase?: string;
  arrivalCheckpoint?: string;
  arrivalConfirmedAt?: string | null;
  jumiaDeliveryFrom?: string | null;
  jumiaDeliveryTo?: string | null;
};

export const MESSAGE_FIELD_LIMITS: Record<keyof ReminderMessageConfig, number> = {
  message: 220, deliveryEstimate: 110, note: 80, emailSubject: 120, emailHeading: 120,
};
export const MESSAGE_VARIABLES = ["first_name", "customer_name", "order_number", "status_update", "courier_update", "tracking_url", "delivery_countdown", "jumia_delivery_window"] as const;
export const DEFAULT_REMINDER_MESSAGES: MessageDefaults = {
  routine: {
    message: "{{status_update}} {{courier_update}}",
    deliveryEstimate: "",
    note: "",
    emailSubject: "Your Renova order update: {{order_number}}",
    emailHeading: "Your latest delivery update",
  },
  arrival: {
    message: "Your order has arrived and is ready for collection. {{courier_update}}",
    deliveryEstimate: "Ready for collection now",
    note: "Please collect your parcel as soon as you can. Thank you for choosing Renova.",
    emailSubject: "Your Renova order has arrived: {{order_number}}",
    emailHeading: "Your order has arrived",
  },
};

export class ReminderMessageError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const LEGACY_DAILY_MESSAGE = "Your daily delivery update: {{status_update}} {{courier_update}}";

export function isAutomaticReminderMessage(kind: EditableMessageKind, message: string) {
  return message === DEFAULT_REMINDER_MESSAGES[kind].message || (kind === "routine" && message === LEGACY_DAILY_MESSAGE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function checkedConfig(value: unknown): Partial<ReminderMessageConfig> {
  if (!isRecord(value)) throw new ReminderMessageError("Enter valid message fields.");
  const result: Partial<ReminderMessageConfig> = {};
  for (const [field, raw] of Object.entries(value)) {
    if (!Object.hasOwn(MESSAGE_FIELD_LIMITS, field) || typeof raw !== "string") throw new ReminderMessageError("Choose a supported message field and enter text.");
    const key = field as keyof ReminderMessageConfig;
    const text = raw.trim();
    if (text.length > MESSAGE_FIELD_LIMITS[key]) throw new ReminderMessageError(`${field} must be ${MESSAGE_FIELD_LIMITS[key]} characters or fewer.`);
    if (["message", "emailSubject", "emailHeading"].includes(field) && !text) throw new ReminderMessageError(`${field} cannot be empty. Use the store default to reset it.`);
    const remaining = text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_match, variable: string) => {
      if (!MESSAGE_VARIABLES.includes(variable as typeof MESSAGE_VARIABLES[number])) throw new ReminderMessageError(`Unknown message variable: ${variable}.`);
      return "";
    });
    if (/[{}]/.test(remaining)) throw new ReminderMessageError("Use the listed message variables with two opening and two closing braces.");
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw new ReminderMessageError("Remove unsupported control characters from the message.");
    result[key] = text;
  }
  return result;
}

export function validateMessageOverrides(value: unknown): MessageOverrides {
  if (!isRecord(value)) throw new ReminderMessageError("Enter valid daily and arrival messages.");
  const result: MessageOverrides = {};
  for (const [kind, fields] of Object.entries(value)) {
    if (kind !== "routine" && kind !== "arrival") throw new ReminderMessageError("Only daily and arrival messages can be edited here.");
    result[kind] = fields === null ? null : checkedConfig(fields);
  }
  return result;
}

export function validateMessageDefaults(value: unknown): MessageDefaults {
  const checked = validateMessageOverrides(value);
  if (!checked.routine || !checked.arrival) throw new ReminderMessageError("Save both the daily and arrival defaults.");
  return {
    routine: { ...DEFAULT_REMINDER_MESSAGES.routine, ...checked.routine },
    arrival: { ...DEFAULT_REMINDER_MESSAGES.arrival, ...checked.arrival },
  };
}

export function parseMessageOverrides(json?: string): MessageOverrides {
  try { return validateMessageOverrides(JSON.parse(json || "{}")); } catch { return {}; }
}

export function resolveReminderMessage(kind: EditableMessageKind, reminder: ReminderMessageSource, defaults: MessageDefaults = DEFAULT_REMINDER_MESSAGES): ReminderMessageConfig {
  const overrides = parseMessageOverrides(reminder.messageOverridesJson);
  const inherited = defaults[kind];
  // Preserve older per-order notes until the owner explicitly resets that kind.
  const reset = Object.hasOwn(overrides, kind) && overrides[kind] === null;
  const legacy = !reset ? {
    ...(kind === "routine" && reminder.deliveryEstimate ? { deliveryEstimate: reminder.deliveryEstimate } : {}),
    ...(reminder.customerNote && (kind === "routine" || reminder.arrivalCheckpoint === undefined) ? { note: reminder.customerNote } : {}),
  } : {};
  const result = { ...inherited, ...legacy, ...overrides[kind] };
  // Existing untouched editor defaults adopt the ready-made wording without
  // rewriting saved dates, real custom messages, consent or schedules.
  if (kind === "routine" && result.message === LEGACY_DAILY_MESSAGE) result.message = DEFAULT_REMINDER_MESSAGES.routine.message;
  return result;
}

export function hasCustomDeliveryLine(kind: EditableMessageKind, reminder: ReminderMessageSource, defaults: MessageDefaults) {
  const overrides = parseMessageOverrides(reminder.messageOverridesJson);
  const local = overrides[kind];
  if (local && Object.hasOwn(local, "deliveryEstimate")) return Boolean(local.deliveryEstimate?.trim());
  if (local !== null && kind === "routine" && reminder.deliveryEstimate) return false;
  return Boolean(defaults[kind].deliveryEstimate.trim());
}

export function renderMessageField(text: string, variables: Record<typeof MESSAGE_VARIABLES[number], string>) {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_match, variable: string) => variables[variable as typeof MESSAGE_VARIABLES[number]] ?? "").trim();
}
