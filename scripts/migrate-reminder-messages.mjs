import { neon } from "@neondatabase/serverless";
import { applyReminderMessageMigration, ReminderMigrationError } from "./reminder-message-migration.mjs";

try {
  let connection;
  try { connection = new URL(process.env.DATABASE_URL || ""); } catch { throw new ReminderMigrationError("Use the restored NEW Renova Neon connection string."); }
  const expectedHost = "ep-sweet-cake-bah8seo5.c-8.eu-central-1.aws.neon.tech";
  if (!["postgres:", "postgresql:"].includes(connection.protocol) || connection.hostname.replace("-pooler.", ".") !== expectedHost) throw new ReminderMigrationError("Use the restored NEW Renova Neon database for this update.");
  console.log(`Checking restored database: ${connection.hostname}`);
  const query = neon(connection.toString());
  const database = {
    query: async (text, params = []) => ({ rows: await query.query(text, params) }),
    transaction: (statements) => query.transaction(statements.map((statement) => query.query(statement.text, statement.params))),
  };
  const result = await applyReminderMessageMigration(database);
  console.log(result.alreadyApplied ? "Message-editor migration is already applied. Nothing changed." : "Message-editor migration completed in one transaction. Existing orders, consent, products, accounts and schedules were retained.");
  console.log("No WhatsApp, email or SMS messages were sent by this migration.");
} catch (error) {
  console.error(error instanceof ReminderMigrationError ? error.message : "The database update did not complete or could not be verified. Retry with the correct restored database connection. A failed migration transaction is rolled back; an applied update is recognized safely on retry.");
  process.exitCode = 1;
}
