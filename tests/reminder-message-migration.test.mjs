import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";

const root = process.env.RENOVA_TEST_SOURCE;
const { applyReminderMessageMigration } = await import(pathToFileURL(join(root, "scripts/reminder-message-migration.mjs")));

test("message-editor migration rolls back failures, preserves existing data and applies once with verified retry", async () => {
  const pg = new PGlite();
  try {
    const journal = JSON.parse(await readFile(join(root, "drizzle-neon/meta/_journal.json"), "utf8"));
    await pg.exec("CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);");
    for (const entry of journal.entries.slice(0, 7)) {
      const sql = await readFile(join(root, `drizzle-neon/${entry.tag}.sql`), "utf8");
      await pg.exec(sql); await pg.query("INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ($1,$2)", [createHash("sha256").update(sql).digest("hex"), entry.when]);
    }
    await pg.exec("INSERT INTO orders (order_number,customer_name,customer_email,customer_phone,total_kobo,items_json,address_json,shipping_json) VALUES ('REN-KEEP','Example','qa@example.invalid','08000000000',10000,'[]','{}','{}'); INSERT INTO order_reminders(order_id,active,consent_confirmed,whatsapp_enabled,current_checkpoint,delivery_estimate,next_send_at) VALUES (1,true,true,true,'Verified courier note','30 October','2026-10-30T10:00:00.000Z');");
    const adapter = (fail) => ({
      query: (text, params = []) => pg.query(text, params),
      async transaction(statements) {
        await pg.exec("BEGIN");
        try {
          for (let i = 0; i < statements.length; i++) {
            const item = statements[i]; await pg.query(item.text, item.params);
            if (fail && i === 5) await pg.exec("ALTER TABLE missing_renova_qa_table ADD COLUMN invalid_qa text");
          }
          await pg.exec("COMMIT");
        } catch (error) { await pg.exec("ROLLBACK"); throw error; }
      },
    });
    await assert.rejects(applyReminderMessageMigration(adapter(true)));
    assert.equal((await pg.query("SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations")).rows[0].count, 7);
    assert.equal((await pg.query("SELECT to_regclass('public.reminder_message_settings') AS name")).rows[0].name, null);
    assert.equal((await pg.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_name='order_reminders' AND column_name='message_overrides_json'")).rows[0].count, 0);
    const first = await applyReminderMessageMigration(adapter(false)); assert.equal(first.alreadyApplied, false);
    const row = (await pg.query("SELECT * FROM order_reminders WHERE order_id=1")).rows[0];
    assert.equal(row.active, true); assert.equal(row.consent_confirmed, true); assert.equal(row.whatsapp_enabled, true);
    assert.equal(row.current_checkpoint, "Verified courier note"); assert.equal(row.delivery_estimate, "30 October"); assert.equal(row.next_send_at, "2026-10-30T10:00:00.000Z");
    assert.equal(row.jumia_delivery_from, null); assert.equal(row.jumia_delivery_to, null);
    await assert.rejects(pg.query("UPDATE order_reminders SET jumia_delivery_from=$1,jumia_delivery_to=$2 WHERE order_id=1", ["2026-11-03", "2026-11-01"]));
    assert.equal(row.reminder_phase, "delivery"); assert.equal(row.message_overrides_json, "{}"); assert.equal(row.arrival_confirmed_at, null);
    assert.equal((await pg.query("SELECT count(*)::int AS count FROM orders")).rows[0].count, 1);
    assert.equal((await applyReminderMessageMigration(adapter(false))).alreadyApplied, true);
    assert.equal((await pg.query("SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations")).rows[0].count, 8);
    await pg.query("UPDATE drizzle.__drizzle_migrations SET hash='wrong-source' WHERE created_at=$1", [journal.entries[6].when]);
    await assert.rejects(applyReminderMessageMigration(adapter(false)), /history differs/);
  } finally { await pg.close(); }
});

test("migration CLI rejects the wrong account without connecting or exposing the connection credentials", () => {
  const result = spawnSync(process.execPath, ["scripts/migrate-reminder-messages.mjs"], { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://qa:fake-private-password@wrong.example.invalid/db" } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /restored NEW Renova Neon/);
  assert.doesNotMatch(result.stdout + result.stderr, /fake-private-password|wrong\.example\.invalid/);
});
