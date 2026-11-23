import type { products } from "../../db/schema";
import { ANAGEN } from "./anagen-offer.mjs";

type AnagenCatalogueOffer = Pick<typeof products.$inferSelect, "sku" | "isPublished" | "paymentMode" | "priceKobo" | "stock">;

export function availableAnagenStock(product: AnagenCatalogueOffer | undefined) {
  if (!product || product.sku !== ANAGEN.sku || !product.isPublished ||
      product.paymentMode !== "cash_on_delivery" || product.priceKobo !== ANAGEN.bundles[0].totalKobo) return null;
  return product.stock;
}
