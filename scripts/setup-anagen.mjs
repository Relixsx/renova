import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import { databaseTarget, postgresConfig } from "../app/lib/postgres-config.mjs";
import { applyAnagenProductSetup, validateAnagenDatabaseUrl } from "./anagen-product-setup.mjs";

let pool;
try {
  const url = validateAnagenDatabaseUrl(process.env.DATABASE_URL || "");
  const stock = Number(process.env.ANAGEN_OPENING_STOCK);
  if (!/^\d+$/.test(process.env.ANAGEN_OPENING_STOCK || "") || !Number.isSafeInteger(stock)) throw new Error("Enter the actual available Anagen pack count.");
  console.log(`Checking restored Renova database: ${url.hostname}`);
  const query = databaseTarget().provider === "neon" ? neon(url.toString()) : null;
  if (!query) pool = new Pool(postgresConfig());
  const database = query ? {
    query: async (text, params = []) => ({ rows: await query.query(text, params) }),
    transaction: (statements) => query.transaction(statements.map((statement) => query.query(statement.text, statement.params))),
  } : {
    query: (text, params = []) => pool.query(text, params),
    transaction: async (statements) => { const client = await pool.connect(); try { await client.query("BEGIN"); for (const item of statements) await client.query(item.text, item.params); await client.query("COMMIT"); } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } },
  };
  const result = await applyAnagenProductSetup(database, stock);
  console.log(result.alreadyApplied ? "Anagen is already set up. Its existing stock and owner edits were kept." : "Anagen product setup completed. Other products, orders and accounts were retained.");
  console.log(`Product: ${result.product.slug}; available packs: ${result.product.stock}`);
  console.log("Manage stock in Renova Admin → Products. The page will be /anagen after your GitHub push and Render deployment.");
  console.log("No customer messages were sent by this setup.");
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  const safe = /^(Use |Enter |This does not|Install the|Anagen's|The Anagen)/.test(message);
  console.error(safe ? message : "Product setup did not complete or could not be verified. Check the restored database connection and try again. Re-running safely preserves any product already created.");
  process.exitCode = 1;
} finally { if (pool) await pool.end(); }
