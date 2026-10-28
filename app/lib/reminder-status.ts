export type ReminderFilter = "all" | "running" | "stopped" | "not_started";
export type ReminderCounts = Record<ReminderFilter, number>;

export type ReminderStatusRecord = {
  orderId: number;
  active: boolean;
  startedAt?: string | null;
  stoppedAt?: string | null;
  lastSentAt?: string | null;
};

type FilterOrder = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  whatsappPhone?: string | null;
};
type FilterContact = { orderId: number; phone?: string | null };

export const REMINDER_FILTERS: { value: ReminderFilter; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "stopped", label: "Stopped" },
  { value: "not_started", label: "Not started" },
  { value: "all", label: "All" },
];

export function reminderStatusFor(reminder?: ReminderStatusRecord): Exclude<ReminderFilter, "all"> {
  // Use the saved schedule, even for an old/completed order. A stale active
  // schedule must stay easy to find and stop instead of vanishing from Running.
  if (reminder?.active) return "running";
  if (reminder?.startedAt || reminder?.stoppedAt || reminder?.lastSentAt) return "stopped";
  // Saving message wording can create an inactive row without ever starting it.
  return "not_started";
}

export function reminderOrderView<T extends FilterOrder>(
  orders: T[], reminders: ReminderStatusRecord[], contacts: FilterContact[],
  filter: ReminderFilter, search = "",
) {
  const byOrder = new Map(reminders.map((reminder) => [reminder.orderId, reminder]));
  const phoneByOrder = new Map(contacts.map((contact) => [contact.orderId, contact.phone]));
  const counts: ReminderCounts = { all: orders.length, running: 0, stopped: 0, not_started: 0 };
  const query = search.trim().toLowerCase();
  const visible = orders.filter((order) => {
    const group = reminderStatusFor(byOrder.get(order.id));
    counts[group] += 1;
    const text = [order.orderNumber, order.customerName, order.customerPhone, order.customerEmail,
      order.whatsappPhone, phoneByOrder.get(order.id)].filter(Boolean).join(" ").toLowerCase();
    return (filter === "all" || filter === group) && text.includes(query);
  });
  return { orders: visible, counts };
}
