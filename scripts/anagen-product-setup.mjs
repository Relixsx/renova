import { ANAGEN, anagenProductValues } from "../app/lib/anagen-offer.mjs";
import { databaseTarget } from "../app/lib/postgres-config.mjs";

export function validateAnagenDatabaseUrl(value) {
  try { return databaseTarget({ DATABASE_URL: value }).url; }
  catch { throw new Error("Use the restored Renova Neon connection or the verified Aiven store database connection."); }
}

// The facade is the same query/transaction contract used by our migrations.
// Setup only inserts this product/category. It never resets catalogue data,
// overwrites an existing product, changes schema, or sends notifications.
export async function applyAnagenProductSetup(database, openingStock) {
  const values = anagenProductValues(openingStock);
  const { rows: store } = await database.query("SELECT (SELECT count(*) FROM products)::int AS products, (SELECT count(*) FROM orders)::int AS orders");
  if (!store[0]?.products || !store[0]?.orders) throw new Error("This does not look like the restored Renova store. No product was added.");
  const { rows: fields } = await database.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND ((table_name = 'orders' AND column_name IN ('whatsapp_phone','whatsapp_consent_source')) OR (table_name = 'order_reminders' AND column_name = 'message_overrides_json'))");
  if (fields.length !== 3) throw new Error("Install the existing Renova WhatsApp and message-editor database updates before setting up Anagen.");
  const { rows: matches } = await database.query("SELECT id, slug, sku, stock FROM products WHERE slug = $1 OR sku = $2", [ANAGEN.slug, ANAGEN.sku]);
  if (matches.length) {
    if (matches.length !== 1 || matches[0].slug !== ANAGEN.slug || matches[0].sku !== ANAGEN.sku) throw new Error("Anagen's slug or SKU is already used by another product. No changes were made.");
    return { alreadyApplied: true, product: matches[0] };
  }
  const columns = Object.keys(values);
  const statements = [
    { text: "INSERT INTO categories (name,slug,description,accent,is_active) VALUES ($1,$2,$3,$4,true) ON CONFLICT (slug) DO NOTHING", params: ["Health & Beauty", ANAGEN.categorySlug, "Skincare, wellness and personal care", "amber"] },
    { text: `INSERT INTO products (${columns.map((key) => `"${key}"`).join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")}) ON CONFLICT DO NOTHING`, params: Object.values(values) },
  ];
  await database.transaction(statements);
  const { rows } = await database.query("SELECT id, slug, sku, stock FROM products WHERE slug = $1", [ANAGEN.slug]);
  if (rows.length !== 1 || rows[0].sku !== ANAGEN.sku) throw new Error("The Anagen product could not be verified. Existing products have not been overwritten.");
  return { alreadyApplied: false, product: rows[0] };
}
