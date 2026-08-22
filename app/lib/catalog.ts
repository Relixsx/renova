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
  badge?: string | null;
  rating: number;
  reviewCount: number;
  isFeatured: boolean;
  isPublished: boolean;
  isTestData: boolean;
  variants: string[];
  specifications?: Record<string, string>;
  brand?: string; model?: string; materials?: string; dimensions?: string; weight?: string;
  colour?: string; size?: string; warranty?: string; packageContents?: string;
  countryOfOrigin?: string; careInstructions?: string; compatibility?: string;
  chatbotKnowledge?: string; chatbotFaq?: Array<{ question: string; answer: string }>;
};

export type Review = {
  id?: number;
  productSlug: string;
  reviewerName: string;
  rating: number;
  title: string;
  body: string;
  isTestData: boolean;
  status?: string;
};

export const categories: Category[] = [
  { name: "Phones & Tablets", slug: "phones-tablets", description: "Smartphones, tablets and mobile essentials", monogram: "PT", accent: "coral", imageUrl: "/categories/phones-tablets.webp", subcategories: ["Smartphones", "Tablets", "Power Banks", "Earphones", "Cases & Screen Protection"] },
  { name: "Computing", slug: "computing", description: "Laptops, accessories and workspace technology", monogram: "CO", accent: "ink", imageUrl: "/categories/computing.webp", subcategories: ["Laptops", "Desktops", "Monitors", "Keyboards & Mice", "Printers & Scanners", "Storage & Networking"] },
  { name: "Electronics", slug: "electronics", description: "Audio, television and smart entertainment", monogram: "EL", accent: "ember", imageUrl: "/categories/electronics.webp", subcategories: ["Televisions", "Home Audio", "Portable Speakers", "Cameras", "Smart Devices"] },
  { name: "Home & Office", slug: "home-office", description: "Practical upgrades for every room", monogram: "HO", accent: "sage", imageUrl: "/categories/home-office.webp", subcategories: ["Furniture", "Lighting", "Bedding", "Cookware", "Storage & Organisation", "Home Décor"] },
  { name: "Appliances", slug: "appliances", description: "Kitchen and household appliances", monogram: "AP", accent: "coral", imageUrl: "/categories/appliances.webp", subcategories: ["Air Fryers", "Blenders", "Kettles", "Fans", "Irons", "Refrigeration & Laundry"] },
  { name: "Fashion", slug: "fashion", description: "Men's, women's and everyday accessories", monogram: "FA", accent: "rose", imageUrl: "/categories/fashion.webp", subcategories: ["Men’s Fashion", "Women’s Fashion", "Shoes", "Bags", "Watches", "Jewellery & Accessories"] },
  { name: "Health & Beauty", slug: "health-beauty", description: "Skincare, wellness and personal care", monogram: "HB", accent: "amber", imageUrl: "/categories/health-beauty.webp", subcategories: ["Skincare", "Hair Care", "Grooming", "Fragrance", "Personal Care", "Wellness"] },
  { name: "Kids Corner", slug: "kids-corner", description: "School, play and growing-up essentials", monogram: "KC", accent: "sky", imageUrl: "/categories/kids-corner.webp", subcategories: ["School Bags", "Lunch Boxes", "Children’s Clothing", "Books & Learning", "Creative Supplies"] },
  { name: "Baby Products", slug: "baby-products", description: "Carefully selected baby essentials", monogram: "BP", accent: "rose", imageUrl: "/categories/baby-products.webp", subcategories: ["Diapers & Wipes", "Feeding", "Bath & Skincare", "Nursery", "Baby Travel", "Clothing"] },
  { name: "Sporting Goods", slug: "sporting-goods", description: "Fitness, movement and active living", monogram: "SG", accent: "sage", imageUrl: "/categories/sporting-goods.webp", subcategories: ["Fitness Equipment", "Running", "Football", "Gym Wear", "Outdoor Recreation"] },
  { name: "Gaming", slug: "gaming", description: "Consoles, games and play accessories", monogram: "GA", accent: "ink", imageUrl: "/categories/gaming.webp", subcategories: ["Consoles", "Controllers", "Video Games", "Gaming Headsets", "Accessories"] },
  { name: "Groceries", slug: "groceries", description: "Pantry and everyday household staples", monogram: "GR", accent: "amber", imageUrl: "/categories/groceries.webp", subcategories: ["Rice & Grains", "Breakfast Foods", "Beverages", "Snacks", "Cooking Essentials", "Household Supplies"] },
  { name: "Garden & Outdoors", slug: "garden-outdoors", description: "Outdoor living and garden tools", monogram: "GO", accent: "sage", imageUrl: "/categories/garden-outdoors.webp", subcategories: ["Garden Tools", "Outdoor Lighting", "Patio & Outdoor Living", "Plant Care", "Grills"] },
  { name: "Automobile", slug: "automobile", description: "Car care, accessories and tools", monogram: "AU", accent: "ink", imageUrl: "/categories/automobile.webp", subcategories: ["Car Electronics", "Tyres & Inflators", "Interior Accessories", "Car Care", "Tools"] },
  { name: "Toys & Games", slug: "toys-games", description: "Playful picks for every age", monogram: "TG", accent: "sky", imageUrl: "/categories/toys-games.webp", subcategories: ["Building Toys", "Board Games", "Educational Toys", "Outdoor Play", "Puzzles"] },
  { name: "Industrial & Scientific", slug: "industrial-scientific", description: "Specialist tools and useful equipment", monogram: "IS", accent: "ember", imageUrl: "/categories/industrial-scientific.webp", subcategories: ["Measuring Tools", "Safety Equipment", "Power Tools", "Electrical Supplies", "Lab Essentials"] },
  { name: "Books, Movies & Music", slug: "books-movies-music", description: "Stories, learning and entertainment", monogram: "BM", accent: "rose", imageUrl: "/categories/books-movies-music.webp", subcategories: ["Fiction", "Non-fiction", "Children’s Books", "Movies", "Music", "Journals"] },
  { name: "Musical Instruments", slug: "musical-instruments", description: "Instruments and creative accessories", monogram: "MI", accent: "amber", imageUrl: "/categories/musical-instruments.webp", subcategories: ["Keyboards", "Guitars", "Percussion", "Studio Equipment", "Accessories"] },
];

const coreSeedProducts: Product[] = [
  {
    name: "Aura QuietMax Wireless Headphones",
    slug: "aura-quietmax-wireless-headphones",
    sku: "REN-AUD-001",
    categorySlug: "electronics",
    shortDescription: "Deep, balanced sound with comfortable all-day cushioning.",
    description: "A clean over-ear design created for focused work, calls and everyday listening. The fold-flat profile travels easily while the cushioned headband keeps long sessions comfortable.",
    priceKobo: 4890000,
    compareAtKobo: 6250000,
    supplierCostKobo: 3470000,
    imageUrl: "/products/aura-headphones.webp",
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
    description: "A compact rechargeable blender with a leak-resistant cup and easy one-button operation. Designed for fruit smoothies, protein shakes and quick everyday blends.",
    priceKobo: 2690000,
    compareAtKobo: 3350000,
    supplierCostKobo: 1830000,
    imageUrl: "/products/ember-blender.webp",
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
    description: "A refined top-handle bag with a spacious interior, secure closure and understated hardware. Built to move neatly from workdays to weekends.",
    priceKobo: 4290000,
    compareAtKobo: 4990000,
    supplierCostKobo: 2940000,
    imageUrl: "/products/atelier-handbag.webp",
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
    description: "A responsive 5G smartphone with an immersive display, dependable battery life and 128GB storage for photos, apps and entertainment.",
    priceKobo: 18990000,
    compareAtKobo: 20990000,
    supplierCostKobo: 16450000,
    imageUrl: "/products/nova-smartphone.webp",
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
    description: "A fragrance-free daily serum with a silky, fast-absorbing finish. Layer under moisturiser morning or evening as part of a simple routine.",
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
    description: "A roomy backpack with a padded back, bottle pocket and organised front compartment. Sized for books, lunch and daily essentials.",
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
    description: "A compact rechargeable fan with adjustable speed, a stable base and quiet airflow for work, study or sleep.",
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
    description: "A lightweight neutral trainer with breathable panels and a supportive cushioned sole. Made for everyday movement and light training.",
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
    description: "A versatile lidded pot with a smooth ceramic nonstick interior and easy-grip side handles. Suitable for soups, stews, rice and one-pot meals.",
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

export const seedProducts: Product[] = [...coreSeedProducts, ...expandedSeedProducts];

export const seedReviews: Review[] = [];

export const formatNaira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);

export const categoryName = (slug: string) =>
  categories.find((category) => category.slug === slug)?.name ?? slug;
