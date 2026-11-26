import manifest from "./previews.json";

type Variant = { width: number; src: string };
const previews: Record<string, Variant[]> = manifest;

export function previewImage(original: string, sizes: string) {
  const variants = previews[original];
  if (!variants) throw new Error("Missing Anagen image previews for " + original);
  return {
    src: variants[Math.floor(variants.length / 2)].src,
    srcSet: variants.map(({ src, width }) => src + " " + width + "w").join(", "),
    sizes,
  };
}
