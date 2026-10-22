export const LAGOS_DELIVERY_ESTIMATE = "3–5 working days";
export const OUTSIDE_LAGOS_DELIVERY_ESTIMATE = "3–12 working days";
export const DEFAULT_DELIVERY_ESTIMATE = "3–5 working days within Lagos and 3–12 working days outside Lagos";
export const DELIVERY_POLICY_TEXT = `Estimated delivery is ${DEFAULT_DELIVERY_ESTIMATE}.`;

const stateCodes = new Set("AB AD AK AN BA BY BE BO CR DE EB ED EK EN FC GO IM JI KD KN KT KE KO KW LA NA NI OG ON OS OY PL RI SO TA YO ZA".split(" "));
const stateNames = new Set("Abia|Adamawa|Akwa Ibom|Anambra|Bauchi|Bayelsa|Benue|Borno|Cross River|Delta|Ebonyi|Edo|Ekiti|Enugu|FCT|Abuja|Federal Capital Territory|Gombe|Imo|Jigawa|Kaduna|Kano|Katsina|Kebbi|Kogi|Kwara|Lagos|Nasarawa|Niger|Ogun|Ondo|Osun|Oyo|Plateau|Rivers|Sokoto|Taraba|Yobe|Zamfara".toLowerCase().split("|"));

// Use the delivery state, never a city, landmark or street mentioning Lagos.
// Unknown/older addresses show both ranges instead of guessing a destination.
export function deliveryRegion(address: unknown): "lagos" | "outside_lagos" | "unknown" {
  if (typeof address === "string") {
    try { address = JSON.parse(address); } catch { return "unknown"; }
  }
  if (!address || typeof address !== "object" || Array.isArray(address)) return "unknown";
  const fields = address as Record<string, unknown>;
  const candidates = [fields.stateCode, fields.state_code, fields.state, fields.stateName, fields.state_name];
  for (const candidate of candidates) {
    const values = candidate && typeof candidate === "object"
      ? [(candidate as Record<string, unknown>).code, (candidate as Record<string, unknown>).name]
      : [candidate];
    for (const value of values) {
      if (typeof value !== "string") continue;
      const normalized = value.trim().replace(/^NG[-_\s]+/i, "").replace(/\s+state$/i, "").trim();
      if (stateCodes.has(normalized.toUpperCase())) return normalized.toUpperCase() === "LA" ? "lagos" : "outside_lagos";
      if (stateNames.has(normalized.toLowerCase())) return normalized.toLowerCase() === "lagos" ? "lagos" : "outside_lagos";
    }
  }
  return "unknown";
}

export function deliveryEstimateForAddress(address?: unknown) {
  const region = deliveryRegion(address);
  return region === "lagos" ? LAGOS_DELIVERY_ESTIMATE : region === "outside_lagos" ? OUTSIDE_LAGOS_DELIVERY_ESTIMATE : DEFAULT_DELIVERY_ESTIMATE;
}

// Refresh generic labels on older orders without replacing a courier's dates
// or an owner's specific estimate.
export function standardDeliveryEstimate(value?: string | null, address?: unknown) {
  const estimate = value?.trim();
  if (!estimate || estimate === DEFAULT_DELIVERY_ESTIMATE || /^(?:3\s*(?:[-–—]|to)\s*(?:5|7|12)|2\s*(?:[-–—]|to)\s*4)\s+(?:(?:working|business)\s+)?days\.?$/i.test(estimate)) {
    return deliveryEstimateForAddress(address);
  }
  return estimate;
}

// Saved product FAQs and custom landing pages can contain older copy. Refresh
// delivery wording when read, without changing the stored product or policies
// about refunds, returns, warranties or battery life.
export function normalizeDeliveryCopy(value: string, deliveryContext = false, address?: unknown): string {
  return value.replace(/[^\n.!?]+[.!?]?/g, (sentence) => {
    if (!deliveryContext && !/\b(deliver\w*|shipping|courier|arriv\w*|transit|dispatch\w*)\b/i.test(sentence)) return sentence;
    if (/\b(refund\w*|return\w*|warrant\w*|battery|recharg\w*)\b/i.test(sentence)) return sentence;
    const outside = /\boutside\s+Lagos\b/i.test(sentence);
    const within = /\b(?:within|inside|in)\s+Lagos\b|\bLagos\s*:/i.test(sentence);
    if (outside && within && /3\s*[-–—]\s*5\s+working\s+days/i.test(sentence) && /3\s*[-–—]\s*12\s+working\s+days/i.test(sentence)) return sentence;
    const estimate = outside && !within ? OUTSIDE_LAGOS_DELIVERY_ESTIMATE : within && !outside ? LAGOS_DELIVERY_ESTIMATE : deliveryEstimateForAddress(address);
    return sentence.replace(/\b(?:3\s*(?:[-–—]|to)\s*(?:5|7|12)|2\s*(?:[-–—]|to)\s*4)\s+(?:(?:working|business)\s+)?days\b/gi, estimate);
  });
}

export function normalizeStructuredDeliveryCopy<T>(value: T): T {
  if (typeof value === "string") return normalizeDeliveryCopy(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizeStructuredDeliveryCopy(item)) as T;
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const deliveryContext = [record.question, record.title, record.label, record.text].some((label) => typeof label === "string" && /\b(deliver\w*|shipping|arriv\w*|courier)\b/i.test(label) && !/\b(return\w*|refund\w*|warrant\w*|battery)\b/i.test(label));
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, typeof item === "string"
    ? normalizeDeliveryCopy(item, deliveryContext || /delivery|shipping|arrival/i.test(key))
    : normalizeStructuredDeliveryCopy(item)])) as T;
}
