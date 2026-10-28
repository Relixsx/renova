"use client";

import { REMINDER_FILTERS, type ReminderCounts, type ReminderFilter } from "../lib/reminder-status";
import styles from "./customer-reminder-bot.module.css";

export function ReminderStatusFilters({ filter, counts, loading, onChange }: {
  filter: ReminderFilter; counts: ReminderCounts; loading: boolean; onChange: (filter: ReminderFilter) => void;
}) {
  return <div className={styles.reminderFilters}>
    <b className={styles.filterLabel}>Reminder status</b>
    <div className={styles.filterButtons} role="group" aria-label="Filter orders by reminder status">
      {REMINDER_FILTERS.map(({ value, label }) => <button key={value} type="button" aria-pressed={filter === value}
        disabled={loading} onClick={() => onChange(value)}>
        <span>{label}</span><span className={styles.filterCount}>{loading ? "…" : counts[value]}</span>
      </button>)}
    </div>
    <p>Running includes daily delivery and arrival reminders across WhatsApp, email and SMS. Orders that have never started reminders appear under Not started.</p>
  </div>;
}

export function StopOrderReminders({ orderNumber, busy, stopping, onStop }: {
  orderNumber: string; busy: boolean; stopping: boolean; onStop: () => void;
}) {
  return <button className={styles.stopReminders} type="button" disabled={busy} onClick={onStop}
    aria-label={`Stop all reminders for ${orderNumber}`}>
    {stopping ? "Stopping…" : "Stop all reminders"}
  </button>;
}
