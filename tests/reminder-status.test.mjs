import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const load = (name) => import(pathToFileURL(join(process.env.RENOVA_TEST_BUILD, `${name}.mjs`)));
const { reminderStatusFor, reminderOrderView } = await load("app/lib/reminder-status");
const { ReminderStatusFilters, StopOrderReminders } = await load("app/components/reminder-status-filters");
const orders = [1, 2, 3, 4, 5].map((id) => ({ id, orderNumber: `REN-FILTER-${id}`, customerName: `Customer ${id}`, customerEmail: `customer${id}@example.invalid`, customerPhone: `0800000000${id}`, status: id === 1 ? "delivered" : "confirmed" }));
const reminders = [
  { orderId: 1, active: true, startedAt: "2026-10-01T10:00:00Z", whatsappEnabled: true },
  { orderId: 2, active: false, stoppedAt: "2026-10-27T10:00:00Z" },
  { orderId: 3, active: false, messageOverridesJson: '{"routine":{"message":"Saved without starting"}}' },
  { orderId: 5, active: true, emailEnabled: true, whatsappEnabled: false },
];
const ids = (view) => view.orders.map((order) => order.id);

test("reminder groups use saved schedules and keep past active orders available to stop", () => {
  const all = reminderOrderView(orders, reminders, [], "all");
  assert.deepEqual(all.counts, { all: 5, running: 2, stopped: 1, not_started: 2 });
  assert.deepEqual(ids(reminderOrderView(orders, reminders, [], "running")), [1, 5]);
  assert.deepEqual(ids(reminderOrderView(orders, reminders, [], "stopped")), [2]);
  assert.deepEqual(ids(reminderOrderView(orders, reminders, [], "not_started")), [3, 4]);
  assert.equal(all.counts.all, all.counts.running + all.counts.stopped + all.counts.not_started);
});

test("saved message drafts are not mislabeled stopped and earlier sending evidence stays stopped", () => {
  assert.equal(reminderStatusFor(), "not_started");
  assert.equal(reminderStatusFor(reminders[2]), "not_started");
  for (const evidence of ["startedAt", "stoppedAt", "lastSentAt"]) assert.equal(reminderStatusFor({ active: false, [evidence]: "2026-10-27T10:00:00Z" }), "stopped");
  assert.equal(reminderStatusFor({ active: true, stoppedAt: "older legacy value" }), "running");
});

test("search combines with the selected group without changing its total or hiding recorded recipients", () => {
  const contacts = [{ orderId: 2, phone: "2349000000002" }];
  for (const query of [" REN-FILTER-2 ", "Customer 2", "customer2@example.invalid", "08000000002", "2349000000002"]) {
    const view = reminderOrderView(orders, reminders, contacts, "stopped", query);
    assert.deepEqual(ids(view), [2]); assert.deepEqual(view.counts, { all: 5, running: 2, stopped: 1, not_started: 2 });
  }
  assert.deepEqual(ids(reminderOrderView(orders, reminders, contacts, "running", "Customer 2")), []);
});

test("stopping moves one order between groups while another channel still running remains visible", () => {
  const afterStop = reminders.map((reminder) => reminder.orderId === 1 ? { ...reminder, active: false, stoppedAt: "2026-10-28T10:00:00Z" } : reminder);
  assert.deepEqual(ids(reminderOrderView(orders, afterStop, [], "stopped")), [1, 2]);
  assert.deepEqual(ids(reminderOrderView(orders, afterStop, [], "running")), [5]);
  assert.equal(reminders[0].active, true);
});

test("status controls expose the selected filter and counts without treating loading as zero", () => {
  const counts = reminderOrderView(orders, reminders, [], "all").counts;
  const html = renderToStaticMarkup(createElement(ReminderStatusFilters, { filter: "stopped", counts, loading: false, onChange() {} }));
  assert.match(html, /aria-label="Filter orders by reminder status"/);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(html, /aria-pressed="true"><span>Stopped<\/span><span[^>]*>1<\/span>/);
  for (const label of ["Running", "Stopped", "Not started", "All"]) assert.ok(html.includes(label));
  const loading = renderToStaticMarkup(createElement(ReminderStatusFilters, { filter: "running", counts, loading: true, onChange() {} }));
  assert.equal((loading.match(/disabled=""/g) || []).length, 4); assert.match(loading, /…/);
});

test("the stop control identifies its order and disables repeat clicks while stopping", () => {
  const html = renderToStaticMarkup(createElement(StopOrderReminders, { orderNumber: "REN-FILTER-1", busy: false, stopping: false, onStop() {} }));
  assert.match(html, /aria-label="Stop all reminders for REN-FILTER-1"/); assert.match(html, />Stop all reminders<\/button>/);
  const busy = renderToStaticMarkup(createElement(StopOrderReminders, { orderNumber: "REN-FILTER-1", busy: true, stopping: true, onStop() {} }));
  assert.match(busy, /disabled=""/); assert.match(busy, />Stopping…<\/button>/);
});
