import ts from "typescript";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(join(root, "node_modules/.cache"), { recursive: true });
const output = await mkdtemp(join(root, "node_modules/.cache/renova-whatsapp-test-"));
const files = ["app/lib/jumia-delivery-countdown.ts", "app/components/reminder-message-editor.tsx", "app/lib/reminder-message-content.ts", "app/lib/reminder-message-settings.ts", "app/lib/catalog.ts", "app/lib/catalog-expanded.ts", "app/api/chat/route.ts", "app/api/orders/track/route.ts", "db/schema.ts", "app/lib/delivery-estimate.ts", "app/lib/whatsapp-order-controls.ts", "app/lib/checkout.ts", "app/lib/checkout-whatsapp.ts", "app/lib/cart-storage.ts", "app/api/checkout/place-order/route.ts", "app/api/checkout/initialize/route.ts", "app/lib/whatsapp-message.ts", "app/lib/whatsapp-delivery.ts", "app/lib/whatsapp-notifications.ts", "app/lib/whatsapp-webhook-security.ts", "app/lib/customer-reminders.ts", "app/lib/order-payment.ts", "app/api/whatsapp/webhook/route.ts", "app/api/orders/reminders/run/route.ts", "app/api/orders/reminders/route.ts"];
files.push("app/api/anagen/order/route.ts", "app/api/anagen/availability/route.ts", "app/lib/anagen-order.ts", "app/lib/anagen-catalogue.ts", "app/lib/anagen-campaign.ts", "app/lib/anagen3-analytics.ts", "app/lib/meta-pixel.ts", "app/components/anagen-order-form.tsx", "app/lib/reminder-status.ts", "app/components/reminder-status-filters.tsx", "app/components/customer-reminder-bot.tsx", "app/components/order-whatsapp-control.tsx");
files.push("app/lib/browser-uuid.ts", "app/lib/anagen-states.ts", "app/lib/anagen-diagnostics.ts");
try {
  for (const file of files) {
    let source = await readFile(join(root, file), "utf8");
    // Next's navigation component is supplied by the framework in production;
    // the isolated React form test only needs its accessible anchor output.
    source = source.replace('import Link from "next/link";', 'import { jsx as testAnchor } from "react/jsx-runtime"; const Link = ({ children, ...props }) => testAnchor("a", { ...props, children });');
    source = source.replace('import { unstable_cache } from "next/cache";', 'const unstable_cache = (read) => read;');
    source = source.replace(/import styles from "[^"\n]+\.module\.css";/g, 'const styles = new Proxy({}, { get: (_target, name) => String(name) });');
    source = source.replace(/from\s+["'](\.[^"']+)["']/g, (whole, path) => {
      const target = resolve(dirname(join(root, file)), path);
      if (path.endsWith(".mjs")) return whole;
      const replacement = target === join(root, "db") ? `${path}/index.mjs` : `${path}.mjs`;
      return `from ${JSON.stringify(replacement)}`;
    });
    const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }, fileName: file });
    const target = join(output, file.replace(/\.tsx?$/, ".mjs"));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, result.outputText);
  }
  await mkdir(join(output, "app/lib"), { recursive: true });
  await writeFile(join(output, "app/lib/anagen-offer.mjs"), await readFile(join(root, "app/lib/anagen-offer.mjs"), "utf8"));
  await writeFile(join(output, "app/lib/owner-order-email.mjs"), await readFile(join(root, "app/lib/owner-order-email.mjs"), "utf8"));
  // Substitute database/catalogue fixtures and owner identity; run production checkout, queue, SQL,
  // formatting, payment hooks and webhook handlers with blocked provider calls.
  await writeFile(join(output, "db/index.mjs"), 'export function getDb() { return globalThis[Symbol.for("renova-whatsapp-test-db")]; }\n');
  await writeFile(join(output, "app/lib/server-catalog.mjs"), 'export async function getProduct(slug) { return globalThis[Symbol.for("renova-whatsapp-test-products")]?.find((product) => product.slug === slug); }\n');
  await writeFile(join(output, "app/lib/admin-auth.mjs"), 'export async function requireOwnerRequest(request) { return request.headers.get("x-renova-test-owner") === "yes" ? null : Response.json({ error: "Owner access required." }, { status: 403 }); }\n');
  // Migration locking and maintenance are exercised by test:migration; these
  // established checkout tests keep their isolated PostgreSQL fixtures.
  await writeFile(join(output, "app/lib/store-writer.mjs"), 'export async function withStoreWriter(_request, work) { return work(); }\n');
  const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "tests/whatsapp.test.mjs", "tests/whatsapp-db.test.mjs", "tests/cart-checkout.test.mjs", "tests/delivery-estimate.test.mjs", "tests/reminder-message-content.test.mjs", "tests/reminder-message-migration.test.mjs", "tests/jumia-delivery-countdown.test.mjs", "tests/reminder-status.test.mjs", "tests/full-reminder-message.test.mjs", "tests/anagen.test.mjs", "tests/owner-order-email.test.mjs"], {
    cwd: root, stdio: "inherit", env: { ...process.env, DATABASE_URL: "", RENOVA_TEST_BUILD: output, RENOVA_TEST_SOURCE: root },
  });
  process.exitCode = result.status ?? 1;
} finally { await rm(output, { recursive: true, force: true }); }
