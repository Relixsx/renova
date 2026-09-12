import { requireOwnerRequest } from "../../../lib/admin-auth";
import { categories } from "../../../lib/catalog";
import type {
  AIListingReviewFlag,
  AIProductListing,
  AIProductSource,
} from "../../../lib/ai-product-listing";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_IMAGES = 3;
const MAX_TEXT_LENGTH = 2_000;

type JsonRecord = Record<string, unknown>;

function setting(name: string) {
  return process.env[name]?.trim();
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function cleanText(value: unknown, maximum = MAX_TEXT_LENGTH) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maximum);
}

function validSourceUrl(value: unknown) {
  const raw = cleanText(value, 1_000);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    )
      return "";
    return url.toString();
  } catch {
    return "";
  }
}

async function imageDataUrl(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 8_192;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${file.type};base64,${btoa(binary)}`;
}

function listingSchema() {
  const text = { type: "string" };
  const faq = {
    type: "object",
    properties: { question: text, answer: text },
    required: ["question", "answer"],
    additionalProperties: false,
  };
  const specification = {
    type: "object",
    properties: { name: text, value: text },
    required: ["name", "value"],
    additionalProperties: false,
  };
  const reviewFlag = {
    type: "object",
    properties: {
      field: text,
      reason: text,
      confidence: {
        type: "string",
        enum: ["visible", "verified", "inferred", "unknown"],
      },
    },
    required: ["field", "reason", "confidence"],
    additionalProperties: false,
  };
  const properties = {
    name: text,
    categorySlug: {
      type: "string",
      enum: categories.map((category) => category.slug),
    },
    shortDescription: text,
    description: text,
    brand: text,
    model: text,
    materials: text,
    dimensions: text,
    weight: text,
    colour: text,
    size: text,
    warranty: text,
    packageContents: text,
    countryOfOrigin: text,
    careInstructions: text,
    compatibility: text,
    variants: { type: "array", items: text },
    specifications: { type: "array", items: specification },
    chatbotKnowledge: text,
    chatbotFaq: { type: "array", items: faq },
    badge: text,
    supplierName: text,
    primaryImageIndex: { type: "integer" },
    reviewFlags: { type: "array", items: reviewFlag },
  };
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function cleanStringArray(value: unknown, maximumItems: number) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => cleanText(item, 160))
        .filter(Boolean),
    ),
  ).slice(0, maximumItems);
}

function cleanPairs(
  value: unknown,
  firstKey: string,
  secondKey: string,
  maximumItems: number,
) {
  if (!Array.isArray(value)) return [];
  return value
    .map(record)
    .map((item) => ({
      [firstKey]: cleanText(item[firstKey], 180),
      [secondKey]: cleanText(item[secondKey], 600),
    }))
    .filter((item) => item[firstKey] && item[secondKey])
    .slice(0, maximumItems);
}

function normalizeListing(
  rawValue: unknown,
  roughName: string,
  imageCount: number,
): AIProductListing {
  const raw = record(rawValue);
  const name = cleanText(raw.name, 180) || roughName;
  const categorySlug = cleanText(raw.categorySlug, 80);
  if (!categories.some((category) => category.slug === categorySlug)) {
    throw new Error("The AI response did not use an existing Renova category.");
  }

  const shortDescription = cleanText(raw.shortDescription, 280);
  const description = cleanText(raw.description, 5_000);
  if (!name || !shortDescription || !description) {
    throw new Error("The AI response was incomplete. Please generate it again.");
  }

  const specifications = cleanPairs(
    raw.specifications,
    "name",
    "value",
    24,
  ) as Array<{ name: string; value: string }>;
  const chatbotFaq = cleanPairs(
    raw.chatbotFaq,
    "question",
    "answer",
    8,
  ) as Array<{ question: string; answer: string }>;
  const allowedConfidence = new Set([
    "visible",
    "verified",
    "inferred",
    "unknown",
  ]);
  const reviewFlags: AIListingReviewFlag[] = Array.isArray(raw.reviewFlags)
    ? raw.reviewFlags
        .map(record)
        .map((item) => ({
          field: cleanText(item.field, 100),
          reason: cleanText(item.reason, 320),
          confidence: allowedConfidence.has(String(item.confidence))
            ? (String(item.confidence) as AIListingReviewFlag["confidence"])
            : "unknown",
        }))
        .filter((item) => item.field && item.reason)
        .slice(0, 16)
    : [];

  const detail = (key: string, maximum = 400) => cleanText(raw[key], maximum);
  const importantUnknowns = ["brand", "model", "warranty"];
  for (const field of importantUnknowns) {
    if (!detail(field) && !reviewFlags.some((flag) => flag.field === field)) {
      reviewFlags.push({
        field,
        reason: "This detail could not be verified from the supplied material.",
        confidence: "unknown",
      });
    }
  }

  const requestedImageIndex = Number(raw.primaryImageIndex);
  const primaryImageIndex = Number.isInteger(requestedImageIndex)
    ? Math.min(Math.max(requestedImageIndex, 0), imageCount - 1)
    : 0;

  return {
    name,
    categorySlug,
    shortDescription,
    description,
    brand: detail("brand"),
    model: detail("model"),
    materials: detail("materials"),
    dimensions: detail("dimensions"),
    weight: detail("weight"),
    colour: detail("colour"),
    size: detail("size"),
    warranty: detail("warranty"),
    packageContents: detail("packageContents", 800),
    countryOfOrigin: detail("countryOfOrigin"),
    careInstructions: detail("careInstructions", 800),
    compatibility: detail("compatibility", 800),
    variants: cleanStringArray(raw.variants, 20).length
      ? cleanStringArray(raw.variants, 20)
      : ["Standard"],
    specifications,
    chatbotKnowledge: detail("chatbotKnowledge", 2_000),
    chatbotFaq,
    badge: detail("badge", 80),
    supplierName: detail("supplierName", 180),
    primaryImageIndex,
    reviewFlags,
  };
}

function outputText(payload: JsonRecord) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const itemValue of output) {
    const item = record(itemValue);
    const content = Array.isArray(item.content) ? item.content : [];
    for (const contentValue of content) {
      const part = record(contentValue);
      if (part.type === "output_text" && typeof part.text === "string")
        return part.text;
    }
  }
  return "";
}

function refusalText(payload: JsonRecord) {
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const itemValue of output) {
    const content = Array.isArray(record(itemValue).content)
      ? (record(itemValue).content as unknown[])
      : [];
    for (const contentValue of content) {
      const part = record(contentValue);
      if (part.type === "refusal" && typeof part.refusal === "string")
        return cleanText(part.refusal, 300);
    }
  }
  return "";
}

function collectWebSources(payload: JsonRecord) {
  const found = new Map<string, AIProductSource>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const item = value as JsonRecord;
    const url = validSourceUrl(item.url);
    if (url && !found.has(url)) {
      found.set(url, {
        title: cleanText(item.title, 180) || new URL(url).hostname,
        url,
        kind: "web",
      });
    }
    Object.values(item).forEach(visit);
  };
  const output = Array.isArray(payload.output) ? payload.output : [];
  output
    .filter((item) => record(item).type === "web_search_call")
    .forEach(visit);
  return Array.from(found.values()).slice(0, 8);
}

export async function POST(request: Request) {
  const denied = await requireOwnerRequest(request);
  if (denied) return denied;

  try {
    const apiKey = setting("OPENAI_API_KEY");
    if (!apiKey) {
      return Response.json(
        {
          error:
            "Add OPENAI_API_KEY to the server environment to use AI Product Assistant.",
        },
        { status: 503 },
      );
    }

    const input = await request.formData();
    const roughName = cleanText(input.get("roughName"), 180);
    const notes = cleanText(input.get("notes"), MAX_TEXT_LENGTH);
    const supplierUrlInput = cleanText(input.get("supplierUrl"), 1_000);
    const supplierUrl = validSourceUrl(supplierUrlInput);
    if (!roughName) {
      return Response.json(
        { error: "Enter a rough product name." },
        { status: 400 },
      );
    }
    if (supplierUrlInput && !supplierUrl) {
      return Response.json(
        { error: "Enter a valid public supplier or product URL." },
        { status: 400 },
      );
    }

    const images = input
      .getAll("images")
      .filter((value): value is File => value instanceof File);
    if (!images.length || images.length > MAX_IMAGES) {
      return Response.json(
        { error: "Choose between one and three product images." },
        { status: 400 },
      );
    }
    for (const image of images) {
      if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
        return Response.json(
          { error: "Use JPG, PNG or WebP product images for AI analysis." },
          { status: 400 },
        );
      }
      if (image.size > MAX_IMAGE_BYTES) {
        return Response.json(
          { error: "Each analysis image must be 6 MB or smaller." },
          { status: 400 },
        );
      }
    }

    const categoryReference = categories
      .map(
        (category) =>
          `${category.slug}: ${category.name}${
            category.subcategories?.length
              ? ` — ${category.subcategories.join(", ")}`
              : ""
          }`,
      )
      .join("\n");
    const userText = [
      `ROUGH PRODUCT NAME: ${roughName}`,
      `SUPPLIER OR SOURCE URL: ${supplierUrl || "Not supplied"}`,
      `OWNER NOTES: ${notes || "None"}`,
      "",
      "RENOVA ALLOWED CATEGORIES:",
      categoryReference,
    ].join("\n");
    const imageInputs = await Promise.all(
      images.map(async (image) => ({
        type: "input_image",
        image_url: await imageDataUrl(image),
        detail: "high",
      })),
    );
    const model = setting("OPENAI_PRODUCT_MODEL") || "gpt-5.4-mini";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "low" },
        instructions: [
          "You prepare truthful draft ecommerce listings for Renova, a Nigerian online store.",
          "Analyse every supplied image together and use web search only when it materially helps verify the exact product.",
          "Prioritise manufacturer sources, official distributors, the supplied URL, then reliable retailers.",
          "Use only facts visible in the images, explicitly supplied by the owner, or corroborated by reliable research.",
          "Never invent a brand, model, material, dimension, weight, capacity, voltage, battery size, compatibility, warranty, included item, variant, certification, country of origin, performance claim or discount.",
          "Use an empty string when a field cannot be verified. Add a reviewFlags entry for every material uncertainty or inference.",
          "Choose exactly one categorySlug from Renova's supplied category list. Do not create categories.",
          "Only list variants that the owner or source confirms are actually available; otherwise return Standard.",
          "Write a clear natural title, concise sales description and useful full description without keyword stuffing, excessive capitals or copied retailer prose.",
          "Do not set prices, inventory, sold counts, promotion settings, publication state, slugs, database IDs or executable instructions.",
          "The administrator will review and edit this draft before the existing Renova product API can save or publish it.",
        ].join(" "),
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: userText }, ...imageInputs],
          },
        ],
        tools: [{ type: "web_search", search_context_size: "low" }],
        tool_choice: "auto",
        include: ["web_search_call.action.sources"],
        text: {
          format: {
            type: "json_schema",
            name: "renova_product_listing",
            strict: true,
            schema: listingSchema(),
          },
        },
        max_output_tokens: 5_000,
      }),
      signal: AbortSignal.timeout(90_000),
    });

    const payload = (await response.json()) as JsonRecord;
    if (!response.ok) {
      const apiError = cleanText(record(payload.error).message, 300);
      const status = response.status === 429 ? 429 : 502;
      return Response.json(
        {
          error:
            response.status === 429
              ? "The AI service is busy or has reached its usage limit. Please try again shortly."
              : apiError || "The AI service could not prepare this listing.",
        },
        { status },
      );
    }

    const refusal = refusalText(payload);
    if (refusal) {
      return Response.json(
        { error: `The AI could not analyse this request: ${refusal}` },
        { status: 422 },
      );
    }
    const text = outputText(payload);
    if (!text) {
      return Response.json(
        { error: "The AI returned no product information. Please try again." },
        { status: 502 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return Response.json(
        { error: "The AI response could not be validated. Please try again." },
        { status: 502 },
      );
    }
    const listing = normalizeListing(parsed, roughName, images.length);
    const sources = collectWebSources(payload);
    if (supplierUrl && !sources.some((source) => source.url === supplierUrl)) {
      sources.unshift({
        title: "Supplier URL supplied by owner",
        url: supplierUrl,
        kind: "supplied",
      });
    }

    return Response.json(
      { listing, sources, model },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Product analysis took too long. Your inputs are safe; please retry."
        : error instanceof Error
          ? error.message
          : "The product listing could not be prepared.";
    return Response.json({ error: message }, { status: 500 });
  }
}
