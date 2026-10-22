import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

// Run through migrate-whatsapp.sh, which reads the URL privately from the tty.
const root = new URL("../", import.meta.url);
const expectedHost = "ep-sweet-cake-bah8seo5.c-8.eu-central-1.aws.neon.tech";
try {
  const connection = new URL(process.env.DATABASE_URL || "");
  if (!["postgres:", "postgresql:"].includes(connection.protocol) || connection.hostname.replace("-pooler.", ".") !== expectedHost) {
    throw new Error("Use the restored NEW Renova Neon database, not the old account or a different project.");
  }
  console.log(`Checking restored database: ${connection.hostname}`);
  const query = neon(connection.toString());
  const journal = JSON.parse(await readFile(new URL("drizzle-neon/meta/_journal.json", root), "utf8"));
  const latest = journal.entries.at(-1), previous = journal.entries.at(-2);
  if (latest.tag !== "0006_whatsapp_order_updates" || previous.idx !== 5) throw new Error("Unexpected migration files. Use this update's unmodified source.");
  const migration = await readFile(new URL(`drizzle-neon/${latest.tag}.sql`, root), "utf8");
  const hash = createHash("sha256").update(migration).digest("hex");
  const required = ["public.orders", "public.products", "public.categories", "public.reviews", "public.order_reminders", "public.order_reminder_logs", "drizzle.__drizzle_migrations"];
  for (const table of required) {
    const [row] = await query`SELECT to_regclass(${table}) AS name`;
    if (!row.name) throw new Error("This database is missing the restored store or migration history. No changes have been made.");
  }
  const history = await query`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`;
  if (history.length === 7 && Number(history.at(-1).created_at) === latest.when && history.at(-1).hash === hash) {
    const [check] = await query`SELECT to_regclass('public.whatsapp_messages') AS messages, to_regclass('public.whatsapp_receipts') AS receipts`;
    if (!check.messages || !check.receipts) throw new Error("The migration history and tables disagree. Stop and inspect before proceeding.");
    console.log("WhatsApp migration is already applied. Nothing changed.");
    process.exit(0);
  }
  if (history.length !== 6 || Number(history.at(-1)?.created_at) !== previous.when) throw new Error("Expected the six restored migrations. No changes have been made; inspect the migration history first.");
  const statements = migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
  // Validate the journal again under a transaction lock, then apply only 0006.
  // Any SQL error rolls back every new table, column, index and journal entry.
  const guard = `DO $renova$ BEGIN IF (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 6 OR (SELECT max(created_at) FROM drizzle.__drizzle_migrations) <> ${Number(previous.when)} THEN RAISE EXCEPTION 'Migration history changed; retry after inspection'; END IF; END $renova$;`;
  await query.transaction([
    query`SELECT pg_advisory_xact_lock(hashtext('renova-whatsapp-0006'))`,
    query.query(guard),
    ...statements.map((statement) => query.query(statement)),
    query`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${latest.when})`,
  ]);
  console.log("WhatsApp migration completed in one transaction. Existing orders, products, reminders and login accounts were retained.");
  console.log(`Migration: ${fileURLToPath(new URL(`drizzle-neon/${latest.tag}.sql`, root))}`);
} catch (error) {
  // Driver exceptions can contain connection details. Print only our own known
  // validation errors; keep provider error payloads out of Terminal and chat.
  const known = error instanceof Error && !error.cause && /^(Use the restored|Unexpected migration|This database|The migration|Expected the six)/.test(error.message);
  console.error(known ? error.message : "Migration did not complete. Its transaction was rolled back. Check the destination and migration history before retrying.");
  process.exitCode = 1;
}
