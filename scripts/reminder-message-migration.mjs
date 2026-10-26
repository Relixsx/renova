import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export class ReminderMigrationError extends Error {}
const columns = ["message_overrides_json", "reminder_phase", "arrival_checkpoint", "arrival_confirmed_at", "arrival_announced_at", "jumia_delivery_from", "jumia_delivery_to"];

export async function applyReminderMessageMigration(database, projectRoot = new URL("../", import.meta.url)) {
  const journal = JSON.parse(await readFile(new URL("drizzle-neon/meta/_journal.json", projectRoot), "utf8"));
  const entry = journal.entries.find((item) => item.idx === 7);
  if (entry?.tag !== "0007_editable_reminder_messages") throw new ReminderMigrationError("Unexpected message-editor migration files. Use the unmodified update.");
  const source = await readFile(new URL(`drizzle-neon/${entry.tag}.sql`, projectRoot), "utf8");
  const hash = createHash("sha256").update(source).digest("hex");
  for (const name of ["public.orders", "public.order_reminders", "public.whatsapp_messages", "public.whatsapp_receipts", "drizzle.__drizzle_migrations"]) {
    const result = await database.query("SELECT to_regclass($1) AS name", [name]);
    if (!result.rows[0]?.name) throw new ReminderMigrationError("The restored store and WhatsApp migration must exist before this update.");
  }
  const history = (await database.query("SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at")).rows;
  for (const item of journal.entries.slice(0, 7)) {
    const previous = history[item.idx];
    const trustedHash = item.idx === 6 ? createHash("sha256").update(await readFile(new URL(`drizzle-neon/${item.tag}.sql`, projectRoot))).digest("hex") : null;
    if (!previous || Number(previous.created_at) !== item.when || (trustedHash && previous.hash !== trustedHash)) throw new ReminderMigrationError("The existing migration history differs from this Renova source. No changes were made.");
  }
  async function verify() {
    const result = await database.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_reminders'");
    if (columns.some((name) => !result.rows.some((row) => row.column_name === name))) throw new ReminderMigrationError("The message-editor migration history and reminder columns disagree.");
    if (!(await database.query("SELECT to_regclass('public.reminder_message_settings') AS name")).rows[0]?.name) throw new ReminderMigrationError("The message-editor settings table is missing.");
    const indexes = await database.query("SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'whatsapp_one_pending_routine'");
    if (!indexes.rows[0]?.indexdef?.includes("arrival_reminder")) throw new ReminderMigrationError("The message-editor queue index does not match this update.");
  }
  if (history.length >= 8 && Number(history[7].created_at) === entry.when && history[7].hash === hash) {
    await verify(); return { alreadyApplied: true };
  }
  if (history.length !== 7) throw new ReminderMigrationError("Expected the seven existing Renova migrations. No changes were made.");
  const previous = journal.entries[6];
  const guard = `DO $renova$ BEGIN IF (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 7 OR (SELECT max(created_at) FROM drizzle.__drizzle_migrations) <> ${Number(previous.when)} THEN RAISE EXCEPTION 'Renova migration history changed'; END IF; END $renova$;`;
  const statements = source.split("--> statement-breakpoint").map((text) => text.trim()).filter(Boolean);
  await database.transaction([
    { text: "LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE", params: [] },
    { text: guard, params: [] },
    ...statements.map((text) => ({ text, params: [] })),
    { text: "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)", params: [hash, entry.when] },
  ]);
  await verify();
  return { alreadyApplied: false };
}
