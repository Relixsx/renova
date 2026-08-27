import { expandedSeedProducts } from "./catalog-expanded";

export type Category = {
  name: string;
  slug: string;
  description: string;
  monogram: string;
  accent: string;
  imageUrl?: string;
  subcategories?: string[];
};

export type LandingTextItem = { title: string; text: string };

export type FlexibleProductPageConfig = {
  theme: {
    background: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    accentSecondary: string;
    buttonText: string;
  };
  navigation: { brandLabel: string; linksEnabled: boolean; ctaLabel: string };
  announcement: {
    enabled: boolean;
    text: string;
    deliveryText: string;
    countdownEnabled: boolean;
    endsAt: string;
  };
  ticker: { enabled: boolean; items: string[] };
  hero: {
    eyebrow: string;
    headline: string;
    highlight: string;
    subtitle: string;
    ctaLabel: string;
    mediaUrl: string;
  };
  metrics: { enabled: boolean; items: LandingTextItem[] };
  trust: { enabled: boolean; items: LandingTextItem[] };
  gallery: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  reviews: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  problem: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    items: string[];
    solutionTitle: string;
    solutionText: string;
    mediaUrl: string;
  };
  features: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
    items: LandingTextItem[];
  };
  process: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
    items: LandingTextItem[];
  };
  comparison: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    beforeTitle: string;
    beforeItems: string[];
    afterTitle: string;
    afterItems: string[];
  };
  offer: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
    stockMessage: string;
    countdownEnabled: boolean;
    endsAt: string;
    ctaLabel: string;
  };
  faq: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
    items: Array<{ question: string; answer: string }>;
  };
  order: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
    buttonLabel: string;
  };
  finalCta: {
    enabled: boolean;
    title: string;
    highlight: string;
    subtitle: string;
    buttonLabel: string;
  };
  stickyCta: { enabled: boolean; label: string };
};

export function defaultFlexibleProductPage(
  product: Partial<Product> = {},
): FlexibleProductPageConfig {
  return {
    theme: {
      background: "#ffffff",
      surface: "#fff7ee",
      text: "#171717",
      muted: "#686868",
      accent: "#ff5a1f",
      accentSecondary: "#ffb72b",
      buttonText: "#ffffff",
    },
    navigation: {
      brandLabel: "RENOVA",
      linksEnabled: true,
      ctaLabel: "Order now",
    },
    announcement: {
      enabled: true,
      text: "Limited-time offer",
      deliveryText: "Free delivery on eligible orders",
      countdownEnabled: false,
      endsAt: "",
    },
    ticker: {
      enabled: true,
      items: [
        "Secure Paystack checkout",
        "Tracked delivery",
        "Email-first support",
      ],
    },
    hero: {
      eyebrow: "RENOVA SELECT",
      headline: product.name || "A better everyday essential",
      highlight: "made for real life.",
      subtitle:
        product.shortDescription ||
        "Clear product information, secure checkout and tracked delivery.",
      ctaLabel: "Order now",
      mediaUrl: product.imageUrl || "",
    },
    metrics: { enabled: false, items: [] },
    trust: {
      enabled: true,
      items: [
        { title: "Free delivery", text: "On eligible campaign orders." },
        { title: "Secure payment", text: "Verified through Paystack." },
        { title: "Track your order", text: "Follow progress after payment." },
      ],
    },
    gallery: {
      enabled: true,
      eyebrow: "TAKE A CLOSER LOOK",
      title: "Every angle. Every detail.",
      subtitle: "Explore the product gallery before you order.",
    },
    reviews: {
      enabled: true,
      eyebrow: "CUSTOMER FEEDBACK",
      title: "What customers are saying",
      subtitle: "Published feedback from customers.",
    },
    problem: {
      enabled: false,
      eyebrow: "WHY IT MATTERS",
      title: "Designed around your everyday needs",
      items: [],
      solutionTitle: "A practical solution",
      solutionText: "",
      mediaUrl: "",
    },
    features: {
      enabled: true,
      eyebrow: "PRODUCT HIGHLIGHTS",
      title: "Why you will love it",
      subtitle: "The details that make this product useful.",
      items: [
        { title: "Practical", text: "Designed for convenient everyday use." },
        {
          title: "Straightforward",
          text: "Clear information helps you choose confidently.",
        },
        {
          title: "Supported",
          text: "Tracked delivery and email-first support are included.",
        },
      ],
    },
    process: {
      enabled: true,
      eyebrow: "HOW TO ORDER",
      title: "Three simple steps",
      subtitle: "A clear path from selection to delivery.",
      items: [
        { title: "Choose", text: "Select your preferred option and quantity." },
        {
          title: "Confirm",
          text: "Enter your delivery details and review your order.",
        },
        {
          title: "Receive",
          text: "Follow your tracking updates until delivery.",
        },
      ],
    },
    comparison: {
      enabled: false,
      eyebrow: "THE DIFFERENCE",
      title: "A clearer choice",
      beforeTitle: "Without it",
      beforeItems: [],
      afterTitle: "With it",
      afterItems: [],
    },
    offer: {
      enabled: true,
      eyebrow: "READY TO ORDER?",
      title: product.name || "Make it yours today",
      subtitle: "Secure checkout and tracked delivery are included.",
      stockMessage: "Available to order",
      countdownEnabled: false,
      endsAt: "",
      ctaLabel: "Order now",
    },
    faq: {
      enabled: true,
      eyebrow: "NEED TO KNOW",
      title: "Frequently asked questions",
      subtitle: "Helpful answers before you order.",
      items: [
        {
          question: "How long does delivery take?",
          answer: "Estimated delivery is 3–5 working days.",
        },
        {
          question: "Can I track my order?",
          answer: "Yes. Your order confirmation includes tracking information.",
        },
      ],
    },
    order: {
      enabled: true,
      eyebrow: "PLACE YOUR ORDER",
      title: "Choose your option",
      subtitle:
        "Select your preferred option and quantity, then continue to secure checkout.",
      buttonLabel: "Order now",
    },
    finalCta: {
      enabled: true,
      title: "Ready when you are.",
      highlight: "Order with confidence.",
      subtitle: "Complete your order through Renova's secure checkout.",
      buttonLabel: "Get yours now",
    },
    stickyCta: { enabled: true, label: "Order now" },
  };
}

export function normalizeFlexibleProductPage(
  product: Partial<Product>,
  raw?: Partial<FlexibleProductPageConfig> | null,
): FlexibleProductPageConfig {
  const fallback = defaultFlexibleProductPage(product);
  const source = raw ?? {};
  const merge = <T extends object>(base: T, value: unknown): T =>
    value && typeof value === "object" && !Array.isArray(value)
      ? { ...base, ...value }
      : base;
  return {
    ...fallback,
    ...source,
    theme: merge(fallback.theme, source.theme),
    navigation: merge(fallback.navigation, source.navigation),
    announcement: merge(fallback.announcement, source.announcement),
    ticker: merge(fallback.ticker, source.ticker),
    hero: merge(fallback.hero, source.hero),
    metrics: merge(fallback.metrics, source.metrics),
    trust: merge(fallback.trust, source.trust),
    gallery: merge(fallback.gallery, source.gallery),
    reviews: merge(fallback.reviews, source.reviews),
    problem: merge(fallback.problem, source.problem),
    features: merge(fallback.features, source.features),
    process: merge(fallback.process, source.process),
    comparison: merge(fallback.comparison, source.comparison),
    offer: merge(fallback.offer, source.offer),
    faq: merge(fallback.faq, source.faq),
    order: merge(fallback.order, source.order),
    finalCta: merge(fallback.finalCta, source.finalCta),
    stickyCta: merge(fallback.stickyCta, source.stickyCta),
  };
}

export type Product = {
  id?: number;
  name: string;
  slug: string;
  sku: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  priceKobo: number;
  compareAtKobo: number | null;
  supplierCostKobo?: number | null;
  imageUrl: string;
  gallery?: string[];
  stock: number;
  soldCount?: number;
  paymentMode?: "prepaid" | "cash_on_delivery";
  badge?: string | null;
  rating: number;
  reviewCount: number;
  isFeatured: boolean;
  isPublished: boolean;
  isTestData: boolean;
  variants: string[];
  specifications?: Record<string, string>;
  brand?: string;
  model?: string;
  materials?: string;
  dimensions?: string;
  weight?: string;
  colour?: string;
  size?: string;
  warranty?: string;
  packageContents?: string;
  countryOfOrigin?: string;
  careInstructions?: string;
  compatibility?: string;
  chatbotKnowledge?: string;
  chatbotFaq?: Array<{ question: string; answer: string }>;
  pageTemplate?: "standard" | "flexible";
  landingPage?: FlexibleProductPageConfig;
};

export function productHref(product: Pick<Product, "slug" | "pageTemplate">) {
  return product.pageTemplate === "flexible"
    ? `/offers/${product.slug}`
    : `/products/${product.slug}`;
}

export type Review = {
  id?: number;
  productSlug: string;
  reviewerName: string;
  rating: number;
  title: string;
  body: string;
  isTestData: boolean;
  isVerifiedPurchase?: boolean;
  reviewedAt?: string | null;
  createdAt?: string;
  status?: string;
};

export const categories: Category[] = [
  {
    name: "Phones & Tablets",
    slug: "phones-tablets",
    description: "Smartphones, tablets and mobile essentials",
    monogram: "PT",
    accent: "coral",
    imageUrl: "/categories/phones-tablets.webp",
    subcategories: [
      "Smartphones",
      "Tablets",
      "Power Banks",
      "Earphones",
      "Cases & Screen Protection",
    ],
  },
  {
    name: "Computing",
    slug: "computing",
    description: "Laptops, accessories and workspace technology",
    monogram: "CO",
    accent: "ink",
    imageUrl: "/categories/computing.webp",
    subcategories: [
      "Laptops",
      "Desktops",
      "Monitors",
      "Keyboards & Mice",
      "Printers & Scanners",
      "Storage & Networking",
    ],
  },
  {
    name: "Electronics",
    slug: "electronics",
    description: "Audio, television and smart entertainment",
    monogram: "EL",
    accent: "ember",
    imageUrl: "/categories/electronics.webp",
    subcategories: [
      "Televisions",
      "Home Audio",
      "Portable Speakers",
      "Cameras",
      "Smart Devices",
    ],
  },
  {
    name: "Home & Office",
    slug: "home-office",
    description: "Practical upgrades for every room",
    monogram: "HO",
    accent: "sage",
    imageUrl: "/categories/home-office.webp",
    subcategories: [
      "Furniture",
      "Lighting",
      "Bedding",
      "Cookware",
      "Storage & Organisation",
      "Home Décor",
    ],
  },
  {
    name: "Appliances",
    slug: "appliances",
    description: "Kitchen and household appliances",
    monogram: "AP",
    accent: "coral",
    imageUrl: "/categories/appliances.webp",
    subcategories: [
      "Air Fryers",
      "Blenders",
      "Kettles",
      "Fans",
      "Irons",
      "Refrigeration & Laundry",
    ],
  },
  {
    name: "Fashion",
    slug: "fashion",
    description: "Men's, women's and everyday accessories",
    monogram: "FA",
    accent: "rose",
    imageUrl: "/categories/fashion.webp",
    subcategories: [
      "Men’s Fashion",
      "Women’s Fashion",
      "Shoes",
      "Bags",
      "Watches",
      "Jewellery & Accessories",
    ],
  },
  {
    name: "Health & Beauty",
    slug: "health-beauty",
    description: "Skincare, wellness and personal care",
    monogram: "HB",
    accent: "amber",
    imageUrl: "/categories/health-beauty.webp",
    subcategories: [
      "Skincare",
      "Hair Care",
      "Grooming",
      "Fragrance",
      "Personal Care",
      "Wellness",
    ],
  },
  {
    name: "Kids Corner",
    slug: "kids-corner",
    description: "School, play and growing-up essentials",
    monogram: "KC",
    accent: "sky",
    imageUrl: "/categories/kids-corner.webp",
    subcategories: [
      "School Bags",
      "Lunch Boxes",
      "Children’s Clothing",
      "Books & Learning",
      "Creative Supplies",
    ],
  },
  {
    name: "Baby Products",
    slug: "baby-products",
    description: "Carefully selected baby essentials",
    monogram: "BP",
    accent: "rose",
    imageUrl: "/categories/baby-products.webp",
    subcategories: [
      "Diapers & Wipes",
      "Feeding",
      "Bath & Skincare",
      "Nursery",
      "Baby Travel",
      "Clothing",
    ],
  },
  {
    name: "Sporting Goods",
    slug: "sporting-goods",
    description: "Fitness, movement and active living",
    monogram: "SG",
    accent: "sage",
    imageUrl: "/categories/sporting-goods.webp",
    subcategories: [
      "Fitness Equipment",
      "Running",
      "Football",
      "Gym Wear",
      "Outdoor Recreation",
    ],
  },
  {
    name: "Gaming",
    slug: "gaming",
    description: "Consoles, games and play accessories",
    monogram: "GA",
    accent: "ink",
    imageUrl: "/categories/gaming.webp",
    subcategories: [
      "Consoles",
      "Controllers",
      "Video Games",
      "Gaming Headsets",
      "Accessories",
    ],
  },
  {
    name: "Groceries",
    slug: "groceries",
    description: "Pantry and everyday household staples",
    monogram: "GR",
    accent: "amber",
    imageUrl: "/categories/groceries.webp",
    subcategories: [
      "Rice & Grains",
      "Breakfast Foods",
      "Beverages",
      "Snacks",
      "Cooking Essentials",
      "Household Supplies",
    ],
  },
  {
    name: "Garden & Outdoors",
    slug: "garden-outdoors",
    description: "Outdoor living and garden tools",
    monogram: "GO",
    accent: "sage",
    imageUrl: "/categories/garden-outdoors.webp",
    subcategories: [
      "Garden Tools",
      "Outdoor Lighting",
      "Patio & Outdoor Living",
      "Plant Care",
      "Grills",
    ],
  },
  {
    name: "Automobile",
    slug: "automobile",
    description: "Car care, accessories and tools",
    monogram: "AU",
    accent: "ink",
    imageUrl: "/categories/automobile.webp",
    subcategories: [
      "Car Electronics",
      "Tyres & Inflators",
      "Interior Accessories",
      "Car Care",
      "Tools",
    ],
  },
  {
    name: "Toys & Games",
    slug: "toys-games",
    description: "Playful picks for every age",
    monogram: "TG",
    accent: "sky",
    imageUrl: "/categories/toys-games.webp",
    subcategories: [
      "Building Toys",
      "Board Games",
      "Educational Toys",
      "Outdoor Play",
      "Puzzles",
    ],
  },
  {
    name: "Industrial & Scientific",
    slug: "industrial-scientific",
    description: "Specialist tools and useful equipment",
    monogram: "IS",
    accent: "ember",
    imageUrl: "/categories/industrial-scientific.webp",
    subcategories: [
      "Measuring Tools",
      "Safety Equipment",
      "Power Tools",
      "Electrical Supplies",
      "Lab Essentials",
    ],
  },
  {
    name: "Books, Movies & Music",
    slug: "books-movies-music",
    description: "Stories, learning and entertainment",
    monogram: "BM",
    accent: "rose",
    imageUrl: "/categories/books-movies-music.webp",
    subcategories: [
      "Fiction",
      "Non-fiction",
      "Children’s Books",
      "Movies",
      "Music",
      "Journals",
    ],
  },
  {
    name: "Musical Instruments",
    slug: "musical-instruments",
    description: "Instruments and creative accessories",
    monogram: "MI",
    accent: "amber",
    imageUrl: "/categories/musical-instruments.webp",
    subcategories: [
      "Keyboards",
      "Guitars",
      "Percussion",
      "Studio Equipment",
      "Accessories",
    ],
  },
];

const coreSeedProducts: Product[] = [
  {
    name: "Aura QuietMax Wireless Headphones",
    slug: "aura-quietmax-wireless-headphones",
    sku: "REN-AUD-001",
    categorySlug: "electronics",
    shortDescription:
      "Deep, balanced sound with comfortable all-day cushioning.",
    description:
      "A clean over-ear design created for focused work, calls and everyday listening. The fold-flat profile travels easily while the cushioned headband keeps long sessions comfortable.",
    priceKobo: 4890000,
    compareAtKobo: 6250000,
    supplierCostKobo: 3470000,
    imageUrl: "/products/aura-headphones-white.webp",
    stock: 18,
    badge: "Renewal deal",
    rating: 48,
    reviewCount: 12,
    isFeatured: true,
    isPublished: true,
    isTestData: true,
    variants: ["Midnight", "Sand"],
  },
  {
    name: "EmberGo Portable Blender",
    slug: "embergo-portable-blender",
    sku: "REN-APP-002",
    categorySlug: "appliances",
    shortDescription: "Fresh smoothies wherever your day takes you.",
    description:
      "A compact rechargeable blender with a leak-resistant cup and easy one-button operation. Designed for fruit smoothies, protein shakes and quick everyday blends.",
    priceKobo: 2690000,
    compareAtKobo: 3350000,
    supplierCostKobo: 1830000,
    imageUrl: "/products/ember-blender-white.webp",
    stock: 24,
    badge: "Popular pick",
    rating: 47,
    reviewCount: 9,
    isFeatured: true,
    isPublished: true,
    isTestData: true,
    variants: ["Coral", "Cream"],
  },
  {
    name: "Atelier Structured Everyday Handbag",
    slug: "atelier-structured-everyday-handbag",
    sku: "REN-FAS-003",
    categorySlug: "fashion",
    shortDescription: "Polished structure with room for every daily essential.",
    description:
      "A refined top-handle bag with a spacious interior, secure closure and understated hardware. Built to move neatly from workdays to weekends.",
    priceKobo: 4290000,
    compareAtKobo: 4990000,
    supplierCostKobo: 2940000,
    imageUrl: "/products/atelier-handbag-white.webp",
    stock: 11,
    badge: "New arrival",
    rating: 49,
    reviewCount: 7,
    isFeatured: true,
    isPublished: true,
    isTestData: true,
    variants: ["Ivory", "Espresso", "Coral"],
  },
  {
    name: "Nova X1 5G Smartphone — 128GB",
    slug: "nova-x1-5g-smartphone",
    sku: "REN-PHN-004",
    categorySlug: "phones-tablets",
    shortDescription: "A fast, capable everyday phone with generous storage.",
    description:
      "A responsive 5G smartphone with an immersive display, dependable battery life and 128GB storage for photos, apps and entertainment.",
    priceKobo: 18990000,
    compareAtKobo: 20990000,
    supplierCostKobo: 16450000,
    imageUrl: "/products/nova-smartphone-white.webp",
    stock: 8,
    badge: "Limited offer",
    rating: 46,
    reviewCount: 14,
    isFeatured: true,
    isPublished: true,
    isTestData: true,
    variants: ["Midnight 128GB", "Graphite 256GB"],
  },
  {
    name: "Renew Barrier Support Face Serum",
    slug: "renew-barrier-support-face-serum",
    sku: "REN-BEA-005",
    categorySlug: "health-beauty",
    shortDescription: "Lightweight daily hydration for a calm-looking glow.",
    description:
      "A fragrance-free daily serum with a silky, fast-absorbing finish. Layer under moisturiser morning or evening as part of a simple routine.",
    priceKobo: 1850000,
    compareAtKobo: 2200000,
    supplierCostKobo: 1120000,
    imageUrl: "/products/renew-serum.webp",
    stock: 31,
    badge: "Beauty edit",
    rating: 48,
    reviewCount: 11,
    isFeatured: true,
    isPublished: true,
    isTestData: true,
    variants: ["30 ml"],
  },
  {
    name: "Scholar Pro Everyday Backpack",
    slug: "scholar-pro-everyday-backpack",
    sku: "REN-KID-006",
    categorySlug: "kids-corner",
    shortDescription: "A sturdy, comfortable school and everyday companion.",
    description:
      "A roomy backpack with a padded back, bottle pocket and organised front compartment. Sized for books, lunch and daily essentials.",
    priceKobo: 2890000,
    compareAtKobo: 3490000,
    supplierCostKobo: 1960000,
    imageUrl: "/products/school-backpack.webp",
    stock: 27,
    badge: "Back-to-school",
    rating: 49,
    reviewCount: 18,
    isFeatured: true,
    isPublished: true,
    isTestData: true,
    variants: ["Navy", "Black", "Burgundy"],
  },
  {
    name: "Breeze Mini Rechargeable Table Fan",
    slug: "breeze-mini-rechargeable-table-fan",
    sku: "REN-HOM-007",
    categorySlug: "home-office",
    shortDescription: "Quiet personal cooling for desks and bedside tables.",
    description:
      "A compact rechargeable fan with adjustable speed, a stable base and quiet airflow for work, study or sleep.",
    priceKobo: 2150000,
    compareAtKobo: 2750000,
    supplierCostKobo: 1390000,
    imageUrl: "/products/breeze-fan.webp",
    stock: 22,
    badge: "Smart essential",
    rating: 45,
    reviewCount: 8,
    isFeatured: true,
    isPublished: true,
    isTestData: true,
    variants: ["White", "Sand"],
  },
  {
    name: "Pace Everyday Running Sneakers",
    slug: "pace-everyday-running-sneakers",
    sku: "REN-SPT-008",
    categorySlug: "sporting-goods",
    shortDescription: "Cushioned comfort for walks, workouts and busy days.",
    description:
      "A lightweight neutral trainer with breathable panels and a supportive cushioned sole. Made for everyday movement and light training.",
    priceKobo: 3990000,
    compareAtKobo: 4700000,
    supplierCostKobo: 2750000,
    imageUrl: "/products/everyday-sneakers.webp",
    stock: 15,
    badge: "Active edit",
    rating: 47,
    reviewCount: 10,
    isFeatured: true,
    isPublished: true,
    isTestData: true,
    variants: ["EU 39", "EU 40", "EU 41", "EU 42", "EU 43", "EU 44"],
  },
  {
    name: "Hearth Ceramic Nonstick Cooking Pot",
    slug: "hearth-ceramic-nonstick-cooking-pot",
    sku: "REN-HOM-009",
    categorySlug: "home-office",
    shortDescription: "Even everyday cooking in a calm, modern silhouette.",
    description:
      "A versatile lidded pot with a smooth ceramic nonstick interior and easy-grip side handles. Suitable for soups, stews, rice and one-pot meals.",
    priceKobo: 3590000,
    compareAtKobo: 4250000,
    supplierCostKobo: 2410000,
    imageUrl: "/products/hearth-pot.webp",
    stock: 13,
    badge: "Home favourite",
    rating: 48,
    reviewCount: 13,
    isFeatured: true,
    isPublished: true,
    isTestData: true,
    variants: ["24 cm", "28 cm"],
  },
];

export const seedProducts: Product[] = [
  ...coreSeedProducts,
  ...expandedSeedProducts,
];

export const seedReviews: Review[] = [];

export const formatNaira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);

export const categoryName = (slug: string) =>
  categories.find((category) => category.slug === slug)?.name ?? slug;
