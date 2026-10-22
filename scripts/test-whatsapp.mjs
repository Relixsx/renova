import ts from "typescript";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(join(root, "node_modules/.cache"), { recursive: true });
const output = await mkdtemp(join(root, "node_modules/.cache/renova-whatsapp-test-"));
const files = ["db/schema.ts", "app/lib/whatsapp-message.ts", "app/lib/whatsapp-delivery.ts", "app/lib/whatsapp-notifications.ts", "app/lib/whatsapp-webhook-security.ts", "app/lib/customer-reminders.ts", "app/lib/order-payment.ts", "app/api/whatsapp/webhook/route.ts", "app/api/orders/reminders/run/route.ts"];
try {
  for (const file of files) {
    let source = await readFile(join(root, file), "utf8");
    source = source.replace(/from\s+["'](\.[^"']+)["']/g, (whole, path) => {
      const target = resolve(dirname(join(root, file)), path);
      const replacement = target === join(root, "db") ? `${path}/index.mjs` : `${path}.mjs`;
      return `from ${JSON.stringify(replacement)}`;
    });
    const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
    const target = join(output, file.replace(/\.ts$/, ".mjs"));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, result.outputText);
  }
  // The only substitution is the database connection. Production queue, SQL,
  // formatting, sender, payment hooks and webhook handlers run unchanged.
  await writeFile(join(output, "db/index.mjs"), 'export function getDb() { return globalThis[Symbol.for("renova-whatsapp-test-db")]; }\n');
  const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "tests/whatsapp.test.mjs", "tests/whatsapp-db.test.mjs"], {
    cwd: root, stdio: "inherit", env: { ...process.env, DATABASE_URL: "", RENOVA_TEST_BUILD: output, RENOVA_TEST_SOURCE: root },
  });
  process.exitCode = result.status ?? 1;
} finally { await rm(output, { recursive: true, force: true }); }
