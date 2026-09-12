import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const failures = [];
let passed = 0;

function check(condition, message) {
  if (condition) passed += 1;
  else failures.push(message);
}

function source(path) {
  check(existsSync(path), `Missing required source file: ${path}`);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

const admin = source("app/components/admin-catalogue.tsx");
const products = source("app/api/products/route.ts");
const promo = source("app/components/product-promo-banner.tsx");
const auth = source("app/lib/admin-auth.ts");
const recovery = source("app/api/admin/password-recovery/route.ts");
const authProxy = source("app/api/auth/[...path]/route.ts");
const exportRoute = source("app/api/orders/export/route.ts");
const reminders = source("app/lib/customer-reminders.ts");
const reminderUi = source("app/components/customer-reminder-bot.tsx");
const reminderApi = source("app/api/orders/reminders/route.ts");
const reminderRun = source("app/api/orders/reminders/run/route.ts");
const reminderWorker = source("deployment/renova-reminder-cron-worker.js");
const schema = source("db/schema.ts");
const paystackVerify = source("app/api/paystack/verify/route.ts");
const paystackWebhook = source("app/api/paystack/webhook/route.ts");
const chat = source("app/api/chat/route.ts");
const productPage = source("app/products/[slug]/page.tsx");

check(
  admin.includes("Optional product promotion") &&
    admin.includes("Recurring two-hour promo cycle") &&
    products.includes("function promoDeadline"),
  "Product promotion controls or persistence are missing.",
);
check(
  promo.includes("cycleLength = 2 * 60 * 60 * 1000") &&
    promo.includes("elapsedSinceDeadline % cycleLength"),
  "Automatic two-hour promotion cycling is missing.",
);
check(
  auth.includes("createNeonAuth") &&
    auth.includes("requireOwnerRequest") &&
    recovery.includes("password") &&
    authProxy.includes("getAuth"),
  "Neon owner authentication or password recovery is incomplete.",
);
check(
  exportRoute.includes('searchParams.get("startDate")') &&
    exportRoute.includes('searchParams.get("endDate")') &&
    exportRoute.includes("new ExcelJS.Workbook()") &&
    admin.includes("Download Excel"),
  "Date-range Excel order export is incomplete.",
);
check(
  /pgTable\(\s*["']order_reminders["']/.test(schema) &&
    schema.includes('pgTable("order_reminder_logs"') &&
    reminders.includes("runDueReminders") &&
    reminderRun.includes("runDueReminders") &&
    reminderWorker.includes("/api/orders/reminders/run"),
  "Scheduled customer reminder workflow is incomplete.",
);
check(
  reminders.includes("WHATSAPP_ACCESS_TOKEN") &&
    reminders.includes("WHATSAPP_REMINDER_TEMPLATE") &&
    reminderUi.includes("whatsappEnabled"),
  "WhatsApp reminder integration is missing.",
);
check(
  reminderUi.includes("Final arrival message from Jumia") &&
    reminderUi.includes("Send Jumia arrival update") &&
    reminderApi.includes('body.action === "arrival"') &&
    reminders.includes('"routine" | "arrival"'),
  "The final manual logistics-arrival workflow is missing.",
);
check(
  paystackVerify.includes("verify") &&
    paystackWebhook.includes("paystack") &&
    existsSync("app/api/checkout/initialize/route.ts") &&
    existsSync("app/api/checkout/place-order/route.ts"),
  "Paystack checkout or order handling is incomplete.",
);
check(
  chat.includes("plainTextReply") &&
    chat.includes("Do not use Markdown") &&
    existsSync("app/components/product-assistant.tsx"),
  "Ask Renova clean-text response handling is missing.",
);
check(
  productPage.includes("ProductPromoBanner") &&
    existsSync("app/products/[slug]/product-trust.module.css") &&
    existsSync("app/components/storefront.tsx"),
  "The V8 product/storefront presentation is incomplete.",
);
check(
  existsSync("drizzle-neon/0005_graceful_clint_barton.sql") &&
    existsSync("drizzle-neon/meta/0005_snapshot.json") &&
    existsSync("drizzle-neon/meta/_journal.json"),
  "The latest reminder database migration set is incomplete.",
);

const sourceFiles = [];
function walk(path) {
  for (const name of readdirSync(path)) {
    const child = join(path, name);
    if (statSync(child).isDirectory()) walk(child);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(name)) sourceFiles.push(child);
  }
}
for (const root of ["app", "db", "scripts", "deployment"]) walk(root);
const missingImports = [];
for (const file of sourceFiles) {
  const value = readFileSync(file, "utf8");
  for (const match of value.matchAll(
    /(?:from\s+|import\s*\()["'](\.[^"']+)["']/g,
  )) {
    const base = resolve(dirname(file), match[1]);
    const candidates = [
      base,
      ...[".ts", ".tsx", ".js", ".mjs", ".json"].map(
        (extension) => base + extension,
      ),
      ...["index.ts", "index.tsx", "index.js", "index.mjs"].map((name) =>
        join(base, name),
      ),
    ];
    if (!candidates.some(isFile)) {
      missingImports.push(`${file}: ${match[1]}`);
    }
  }
}
check(
  missingImports.length === 0,
  `Unresolved relative imports: ${missingImports.join(", ")}`,
);

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const lockedRoot = packageLock.packages?.[""] ?? {};
check(
  ["dependencies", "devDependencies"].every(
    (key) =>
      JSON.stringify(Object.keys(packageJson[key] ?? {}).sort()) ===
      JSON.stringify(Object.keys(lockedRoot[key] ?? {}).sort()),
  ),
  "package.json and package-lock.json dependency sets differ.",
);

if (failures.length) {
  console.error("Cumulative Renova source verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Cumulative Renova source verification passed (${passed} checks).`);
