import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const files = {
  admin: "app/components/admin-catalogue.tsx",
  assistant: "app/components/ai-product-assistant.tsx",
  styles: "app/components/ai-product-assistant.module.css",
  endpoint: "app/api/products/ai-assist/route.ts",
  types: "app/lib/ai-product-listing.ts",
  productApi: "app/api/products/route.ts",
  schema: "db/schema.ts",
};

const contents = {};
const failures = [];
let passedChecks = 0;

function check(condition, message) {
  if (!condition) failures.push(message);
  else passedChecks += 1;
}

for (const [name, relativePath] of Object.entries(files)) {
  const absolutePath = resolve(root, relativePath);
  check(existsSync(absolutePath), `${name}: missing ${relativePath}`);
  contents[name] = existsSync(absolutePath)
    ? readFileSync(absolutePath, "utf8")
    : "";
}

check(
  contents.endpoint.includes("requireOwnerRequest(request)"),
  "AI endpoint must use the existing owner authorization guard.",
);
check(
  contents.endpoint.includes("process.env[name]") &&
    contents.endpoint.includes('setting("OPENAI_API_KEY")'),
  "OpenAI credentials must stay in the server environment.",
);
check(
  !contents.endpoint.includes("NEXT_PUBLIC_OPENAI"),
  "OpenAI credentials must never use a public browser variable.",
);
check(
  contents.endpoint.includes("https://api.openai.com/v1/responses") &&
    contents.endpoint.includes('type: "json_schema"') &&
    contents.endpoint.includes("strict: true"),
  "AI endpoint must use the Responses API with strict Structured Outputs.",
);
check(
  contents.endpoint.includes('type: "web_search"') &&
    contents.endpoint.includes('type: "input_image"'),
  "AI endpoint must retain multimodal analysis and product research.",
);
check(
  contents.endpoint.includes("const MAX_IMAGES = 3") &&
    contents.endpoint.includes("ALLOWED_IMAGE_TYPES"),
  "AI endpoint must enforce image count and type limits.",
);
check(
  !/(from\s+["'][^"']*(?:db|schema)|\.(?:insert|update|delete)\s*\()/i.test(
    contents.endpoint,
  ),
  "AI endpoint must not write directly to the product database.",
);
check(
  contents.admin.includes("<AIProductAssistant") &&
    contents.admin.includes("onApply={applyAiListing}"),
  "The assistant must be connected to the existing admin.",
);
check(
  contents.admin.includes("function openNew(") &&
    contents.admin.includes("async function submitProduct(") &&
    contents.admin.includes('fetch("/api/products"'),
  "The original manual product flow and product API must remain present.",
);
check(
  contents.admin.includes('isPublished: false') &&
    contents.assistant.includes("Review in product form"),
  "AI listings must enter a reviewable draft state before publishing.",
);
check(
  contents.admin.includes('fetch("/api/media/signature"'),
  "The existing signed media upload pipeline must remain present.",
);
check(
  contents.assistant.includes("Possible duplicate product") &&
    contents.assistant.includes("reviewFlags") &&
    contents.assistant.includes("Regenerate listing"),
  "Duplicate, uncertainty and retry controls must remain present.",
);

const usedStyleNames = new Set(
  Array.from(contents.assistant.matchAll(/styles\.([A-Za-z][A-Za-z0-9_]*)/g),
    (match) => match[1],
  ),
);
const definedStyleNames = new Set(
  Array.from(contents.styles.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g),
    (match) => match[1],
  ),
);
const missingStyles = Array.from(usedStyleNames).filter(
  (name) => !definedStyleNames.has(name),
);
check(
  missingStyles.length === 0,
  `Missing assistant CSS classes: ${missingStyles.join(", ")}`,
);

if (failures.length) {
  console.error("AI Product Assistant verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `AI Product Assistant verification passed (${passedChecks} safeguards checked).`,
);
