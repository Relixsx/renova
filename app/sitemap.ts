import type { MetadataRoute } from "next";
import { categories, productHref } from "./lib/catalog";
import { getProducts } from "./lib/server-catalog";
import { absoluteUrl } from "./lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  const staticRoutes = [
    "/",
    "/shop",
    "/about",
    "/delivery",
    "/returns",
    "/privacy",
    "/terms",
    "/track-order",
  ];
  return [
    ...staticRoutes.map((path) => ({
      url: absoluteUrl(path),
      changeFrequency:
        path === "/" || path === "/shop"
          ? ("daily" as const)
          : ("monthly" as const),
      priority: path === "/" ? 1 : 0.6,
    })),
    ...categories.map((category) => ({
      url: absoluteUrl(`/collections/${category.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(productHref(product)),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
