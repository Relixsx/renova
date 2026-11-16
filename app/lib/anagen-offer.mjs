// Shared by the landing page, server checkout and one-time product setup.
// Amounts are integer kobo. Never take a selling price from a form submission.
export const ANAGEN = Object.freeze({
  slug: "anagen",
  path: "/anagen",
  sku: "REN-ANAGEN-10G",
  name: "Anagen Organic Hair Growth Treatment",
  version: "anagen-2026-11-14",
  estimate: "1–2 working days",
  shippingName: "Anagen doorstep delivery",
  categorySlug: "health-beauty",
  bundles: Object.freeze([
    { packs: 1, label: "1 pack", totalKobo: 1120000, savingKobo: 0 },
    { packs: 2, label: "2 packs", totalKobo: 2040000, savingKobo: 200000 },
    { packs: 3, label: "3 packs", totalKobo: 2860000, savingKobo: 500000 },
  ]),
});

export function anagenProductValues(openingStock) {
  if (!Number.isInteger(openingStock) || openingStock < 0 || openingStock > 100000) {
    throw new Error("Enter the actual available pack count, from 0 to 100000.");
  }
  return {
    name: ANAGEN.name, slug: ANAGEN.slug, sku: ANAGEN.sku,
    category_slug: ANAGEN.categorySlug,
    short_description: "10g herbal hair-care blend. Each pack contains two sachets and an application guide. Free doorstep delivery; pay on delivery.",
    description: "Anagen is a solid herbal hair-care blend for mixing with your preferred hair cream or oil. Each pack contains two sachets and a step-by-step application guide. Choose 1 pack for ₦11,200, 2 packs for ₦20,400 or 3 packs for ₦28,600 on the dedicated Anagen page. Free doorstep delivery nationwide. Same-day delivery in state capitals; estimated delivery 1–2 working days, subject to address and dispatch confirmation.",
    price_kobo: ANAGEN.bundles[0].totalKobo, compare_at_kobo: 1500000,
    image_url: "/anagen/ari.jpg",
    gallery_json: JSON.stringify(["/anagen/raw.jpg", "/anagen/anagenraw.jpg", "/anagen/ari.jpg", "/anagen/Anagen.jpg", "/anagen/anagenbag.jpg", "/anagen/anagenbagg.png"]),
    variants_json: JSON.stringify(["10g pack · 2 sachets"]),
    specifications_json: JSON.stringify({ "Pack size": "10g", "Sachets per pack": "2", "Product form": "Herbal blend", "Order page": ANAGEN.path }),
    brand: "Anagen", model: "Herbal Hair Reviver", weight: "10g per pack",
    package_contents: "2 sachets of Anagen natural mix powder and a printed application guide per pack",
    care_instructions: "Follow the application guide supplied with the product.",
    stock: openingStock, payment_mode: "cash_on_delivery", badge: "Anagen offer",
    is_featured: false, is_published: true, is_test_data: false,
    page_template: "standard", supplier_name: "", supplier_url: "",
    chatbot_knowledge: "Order Anagen at /anagen. The dedicated page offers 1 pack for ₦11,200, 2 for ₦20,400 and 3 for ₦28,600. Free doorstep delivery and payment on delivery. Each pack contains 2 sachets and an application guide.",
    chatbot_faq_json: JSON.stringify([
      { question: "Where can I order Anagen?", answer: "Use the order form at /anagen to select your bundle, address and separate WhatsApp number." },
      { question: "What are the Anagen bundle prices?", answer: "1 pack: ₦11,200. 2 packs: ₦20,400. 3 packs: ₦28,600. Doorstep delivery is free and payment is on delivery." },
      { question: "When will Anagen arrive?", answer: "Same-day delivery is offered in state capitals. Estimated delivery is 1–2 working days, subject to address and dispatch confirmation." },
    ]),
  };
}
