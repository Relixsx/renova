import { existsSync, readFileSync } from "node:fs";

const failures = [];
let passed = 0;

function check(condition, message) {
  if (condition) passed += 1;
  else failures.push(message);
}

function source(path) {
  check(existsSync(path), `Missing required file: ${path}`);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const admin = source("app/components/admin-catalogue.tsx");
const assistant = source("app/components/ai-product-assistant.tsx");
const assistantTypes = source("app/lib/ai-product-listing.ts");
const assistantApi = source("app/api/products/ai-assist/route.ts");
const workspace = source("app/admin/admin-workspace.tsx");
const styles = source("app/globals.css");

const routes = [
  ["overview", "app/admin/page.tsx"],
  ["products", "app/admin/products/page.tsx"],
  ["ai-listing", "app/admin/ai-listing/page.tsx"],
  ["categories", "app/admin/categories/page.tsx"],
  ["orders", "app/admin/orders/page.tsx"],
  ["reminders", "app/admin/reminders/page.tsx"],
  ["reviews", "app/admin/reviews/page.tsx"],
];

for (const [section, path] of routes) {
  const route = source(path);
  check(
    route.includes(`section="${section}"`),
    `${path} must render the shared ${section} workspace.`,
  );
}

check(
  workspace.includes("requireOwnerPage()") &&
    workspace.includes("<AdminCatalogue") &&
    workspace.includes("activeSection={section}"),
  "Every admin route must pass through the existing owner guard and shared admin.",
);
check(
  admin.includes('href: "/admin/products"') &&
    admin.includes('href: "/admin/ai-listing"') &&
    admin.includes('href: "/admin/orders"') &&
    !admin.includes('href="#overview"'),
  "Admin navigation must use real routes rather than one-page anchors.",
);
for (const section of [
  "overview",
  "products",
  "ai-listing",
  "categories",
  "orders",
  "reminders",
  "reviews",
]) {
  check(
    admin.includes(`activeSection === "${section}"`),
    `Admin must render ${section} as a focused page.`,
  );
}
check(
  admin.includes("function openNew(") &&
    admin.includes("async function submitProduct(") &&
    admin.includes('fetch("/api/products"'),
  "The existing manual product form and publishing path must remain intact.",
);
check(
  assistantTypes.includes('paymentMode: "prepaid" | "cash_on_delivery"') &&
    assistant.includes("Pay before delivery") &&
    assistant.includes("Payment on delivery") &&
    admin.includes("paymentMode: values.paymentMode"),
  "AI listing must preserve the owner's explicit payment decision.",
);
check(
  assistantTypes.includes("promoEnabled: boolean") &&
    assistant.includes("Should this product carry a promo?") &&
    admin.includes("promoEnabled: values.promoEnabled") &&
    admin.includes("compareAtNaira: values.promoEnabled"),
  "AI listing must preserve the owner's explicit promo decision.",
);
check(
  assistant.includes("supported.slice(0, 3)") &&
    assistant.includes("Choose at least one product image") &&
    assistantApi.includes("const MAX_IMAGES = 3"),
  "The one-to-three image limit must be enforced in the browser and backend.",
);
check(
  styles.includes(".admin-dashboard-grid") &&
    styles.includes(".admin-nav-group") &&
    styles.includes("overflow-x: auto") &&
    styles.includes("position: sticky"),
  "Responsive routed admin navigation styles are incomplete.",
);
check(
  admin.includes("<CustomerReminderBot orders={orderRows}") &&
    admin.includes("Download Excel") &&
    admin.includes("openReviewManager"),
  "Existing reminders, exports or review management must remain connected.",
);

if (failures.length) {
  console.error("Renova admin workspace verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Renova admin workspace verification passed (${passed} checks).`,
);
