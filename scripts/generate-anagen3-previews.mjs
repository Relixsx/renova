import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicRoot = new URL("../public/", import.meta.url);
const output = new URL("anagen3/previews/", publicRoot);
const manifest = new URL("../app/anagen3/previews.json", import.meta.url);
await mkdir(output, { recursive: true });

const pack = [
  [360, "/anagen3/pack-860.webp"],
  [540, "/anagen3/pack-540.webp"],
  [860, "/anagen3/pack-860.webp"],
];
const specifications = [
  ["/anagen3/pack-860.webp", pack.map(([width]) => width), 82],
  ...Array.from({ length: 9 }, (_, index) => [
    "/anagen/customer-gallery/photo-" + String(index + 1).padStart(2, "0") + ".webp",
    [360, 540, 720, 860, 1080], 74,
  ]),
  ...["edges", "breakage", "scalp"].map(concern => [
    "/anagen3/concern-" + concern + ".webp", [320, 420, 540], 76,
  ]),
  ...Array.from({ length: 5 }, (_, index) => [
    "/anagen3/testimonials/whatsapp-" + (index + 1) + ".png",
    [480, 720, 941], 84,
  ]),
];

const result = {};
for (const [source, widths, quality] of specifications) {
  const original = new URL(source.slice(1), publicRoot);
  const stem = basename(source).replace(/\.[a-z]+$/, "");
  const variants = [];
  for (const width of widths) {
    // Keep the existing 540 and 860 px pack versions byte for byte.
    const exactPack = source === "/anagen3/pack-860.webp" && width >= 540
      ? pack.find(([size]) => size === width)?.[1]
      : undefined;
    const bytes = exactPack
      ? await readFile(new URL(exactPack.slice(1), publicRoot))
      : await sharp(fileURLToPath(original)).resize({ width, withoutEnlargement: true })
        .webp({ quality, effort: 6 }).toBuffer();
    const { width: actualWidth } = await sharp(bytes).metadata();
    if (actualWidth !== width) throw new Error("Unexpected image width for " + source);
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    const filename = stem + "-" + width + "." + hash + ".webp";
    await writeFile(new URL(filename, output), bytes);
    variants.push({ width, src: "/anagen3/previews/" + filename });
  }
  result[source] = variants;
}
await writeFile(manifest, JSON.stringify(result, null, 2) + "\n");
