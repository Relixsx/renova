import { ReminderMessageError } from "./reminder-message-content";

export type JumiaDeliveryWindow = { from: string | null; to: string | null };
export type JumiaDeliverySource = { jumiaDeliveryFrom?: string | null; jumiaDeliveryTo?: string | null };
const DAY_MS = 86_400_000;

function calendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > 9999) return null;
  const milliseconds = Date.UTC(year, month - 1, day);
  const parsed = new Date(milliseconds);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return milliseconds / DAY_MS;
}

export function nigeriaCalendarDate(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}-${parts.find((part) => part.type === "day")!.value}`;
}

export function validateJumiaDeliveryWindow(value: unknown): JumiaDeliveryWindow {
  if (value === null) return { from: null, to: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReminderMessageError("Enter the Jumia delivery dates using the date fields.");
  const fields = value as Record<string, unknown>;
  if (Object.keys(fields).some((key) => key !== "from" && key !== "to")) throw new ReminderMessageError("Choose only the expected-from and expected-to dates.");
  if ((fields.from === "" || fields.from === null) && (fields.to === "" || fields.to === null || fields.to === undefined)) return { from: null, to: null };
  if (typeof fields.from !== "string" || calendarDay(fields.from) === null) throw new ReminderMessageError("Choose a valid Jumia expected-from date first.");
  const to = fields.to === undefined || fields.to === null || fields.to === "" ? fields.from : fields.to;
  if (typeof to !== "string" || calendarDay(to) === null) throw new ReminderMessageError("Choose a valid Jumia expected-to date.");
  if (calendarDay(to)! < calendarDay(fields.from)!) throw new ReminderMessageError("The Jumia expected-to date must be on or after the expected-from date.");
  return { from: fields.from, to };
}

function formatDate(value: string, includeYear = true) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", ...(includeYear ? { year: "numeric" } : {}) }).format(new Date(`${value}T12:00:00Z`));
}

export function jumiaDeliveryWindowLabel(from: string, to: string) {
  if (from === to) return formatDate(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))}–${formatDate(to)}`;
  if (from.slice(0, 4) === to.slice(0, 4)) return `${formatDate(from, false)} – ${formatDate(to)}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}

export function jumiaDeliveryCountdown(source: JumiaDeliverySource, now: Date = new Date()) {
  if (!source.jumiaDeliveryFrom) return null;
  let window: JumiaDeliveryWindow;
  try { window = validateJumiaDeliveryWindow({ from: source.jumiaDeliveryFrom, to: source.jumiaDeliveryTo }); } catch { return null; }
  if (!window.from || !window.to || Number.isNaN(now.getTime())) return null;
  const today = nigeriaCalendarDate(now);
  const todayDay = calendarDay(today)!;
  const fromDays = calendarDay(window.from)! - todayDay;
  const toDays = calendarDay(window.to)! - todayDay;
  const dateLabel = jumiaDeliveryWindowLabel(window.from, window.to);
  let state: "upcoming" | "in_window" | "today" | "overdue";
  let message: string;
  if (toDays < 0) {
    state = "overdue";
    message = "The estimated delivery window has passed; arrival is not yet confirmed. We will share a verified update.";
  } else if (toDays === 0) {
    state = "today";
    message = "Your order is expected today. We will notify you as soon as arrival is confirmed.";
  } else if (fromDays <= 0) {
    state = "in_window";
    message = toDays === 1
      ? "Your order is expected today or tomorrow. We will notify you once arrival is confirmed."
      : `Your order is expected today or within the next ${toDays} days. We will notify you once arrival is confirmed.`;
  } else {
    state = "upcoming";
    message = fromDays === 1 && toDays === 1 ? "Your order is expected tomorrow."
      : fromDays === toDays ? `Your order is expected in ${fromDays} days.`
      : `Your order is expected in ${fromDays}–${toDays} days${fromDays === 1 ? ", starting tomorrow" : ""}.`;
  }
  return { today, from: window.from, to: window.to, fromDays, toDays, state, message, dateLabel };
}
