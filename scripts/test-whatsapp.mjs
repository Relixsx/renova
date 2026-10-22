import ts from "typescript";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(join(root, "node_modules/.cache"), { recursive: true });
const output = await mkdtemp(join(root, "node_modules/.cache/renova-whatsapp-test-"));
const files = ["app/lib/catalog.ts", "app/lib/catalog-expanded.ts", "app/api/chat/route.ts", "app/api/orders/track/route.ts", "db/schema.ts", "app/lib/delivery-estimate.ts", "app/lib/whatsapp-order-controls.ts", "app/lib/checkout.ts", "app/lib/checkout-whatsapp.ts", "app/lib/cart-storage.ts", "app/api/checkout/place-order/route.ts", "app/api/checkout/initialize/route.ts", "app/lib/whatsapp-message.ts", "app/lib/whatsapp-delivery.ts", "app/lib/whatsapp-notifications.ts", "app/lib/whatsapp-webhook-security.ts", "app/lib/customer-reminders.ts", "app/lib/order-payment.ts", "app/api/whatsapp/webhook/route.ts", "app/api/orders/reminders/run/route.ts", "app/api/orders/reminders/route.ts"];
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
  // Substitute database/catalogue fixtures and owner identity; run production checkout, queue, SQL,
  // formatting, payment hooks and webhook handlers with blocked provider calls.
  await writeFile(join(output, "db/index.mjs"), 'export function getDb() { return globalThis[Symbol.for("renova-whatsapp-test-db")]; }\n');
  await writeFile(join(output, "app/lib/server-catalog.mjs"), 'export async function getProduct(slug) { return globalThis[Symbol.for("renova-whatsapp-test-products")]?.find((product) => product.slug === slug); }\n');
  await writeFile(join(output, "app/lib/admin-auth.mjs"), 'export async function requireOwnerRequest(request) { return request.headers.get("x-renova-test-owner") === "yes" ? null : Response.json({ error: "Owner access required." }, { status: 403 }); }\n');
  const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "tests/whatsapp.test.mjs", "tests/whatsapp-db.test.mjs", "tests/cart-checkout.test.mjs", "tests/delivery-estimate.test.mjs"], {
    cwd: root, stdio: "inherit", env: { ...process.env, DATABASE_URL: "", RENOVA_TEST_BUILD: output, RENOVA_TEST_SOURCE: root },
  });
  process.exitCode = result.status ?? 1;
} finally { await rm(output, { recursive: true, force: true }); }
