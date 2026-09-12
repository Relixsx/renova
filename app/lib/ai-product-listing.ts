export type AIListingReviewFlag = {
  field: string;
  reason: string;
  confidence: "visible" | "verified" | "inferred" | "unknown";
};

export type AIProductListing = {
  name: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  brand: string;
  model: string;
  materials: string;
  dimensions: string;
  weight: string;
  colour: string;
  size: string;
  warranty: string;
  packageContents: string;
  countryOfOrigin: string;
  careInstructions: string;
  compatibility: string;
  variants: string[];
  specifications: Array<{ name: string; value: string }>;
  chatbotKnowledge: string;
  chatbotFaq: Array<{ question: string; answer: string }>;
  badge: string;
  supplierName: string;
  primaryImageIndex: number;
  reviewFlags: AIListingReviewFlag[];
};

export type AIProductSource = {
  title: string;
  url: string;
  kind: "web" | "supplied";
};

export type AIProductAssistantValues = {
  roughName: string;
  supplierUrl: string;
  sellingPrice: string;
  costPrice: string;
  stock: string;
  notes: string;
  paymentMode: "prepaid" | "cash_on_delivery";
  promoEnabled: boolean;
  promoLabel: string;
  compareAtPrice: string;
};

export type AIProductAssistantResult = {
  listing: AIProductListing;
  sources: AIProductSource[];
  model: string;
};
