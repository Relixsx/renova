"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "../lib/catalog";
const key = (name: string) => `renova:${name}`;
function read(name: string): Product[] { try { return JSON.parse(localStorage.getItem(key(name)) || "[]") as Product[]; } catch { return []; } }
function write(name: string, items: Product[]) { localStorage.setItem(key(name), JSON.stringify(items)); window.dispatchEvent(new Event("renova-saved")); }
export function ShopperTools({ product, recordView = false }: { product: Product; recordView?: boolean }) {
  const [saved, setSaved] = useState(false); const [compared, setCompared] = useState(false);
  useEffect(() => { setSaved(read("wishlist").some((item) => item.slug === product.slug)); setCompared(read("compare").some((item) => item.slug === product.slug)); if (recordView) write("recent", [product, ...read("recent").filter((item) => item.slug !== product.slug)].slice(0, 12)); }, [product.slug, recordView]);
  function toggle(name: "wishlist" | "compare") { const items = read(name); const exists = items.some((item) => item.slug === product.slug); const next = exists ? items.filter((item) => item.slug !== product.slug) : [product, ...items].slice(0, name === "compare" ? 3 : 30); write(name, next); if (name === "wishlist") setSaved(!exists); else setCompared(!exists); }
  return <div className="shopper-tools"><button onClick={() => toggle("wishlist")} aria-pressed={saved}>{saved ? "♥ Saved" : "♡ Save"}</button><button onClick={() => toggle("compare")} aria-pressed={compared}>{compared ? "✓ Comparing" : "⇄ Compare"}</button>{compared && <Link href="/saved">View</Link>}</div>;
}
export function SavedCollections() {
  const [wishlist, setWishlist] = useState<Product[]>([]); const [recent, setRecent] = useState<Product[]>([]); const [compare, setCompare] = useState<Product[]>([]);
  useEffect(() => { const load = () => { setWishlist(read("wishlist")); setRecent(read("recent")); setCompare(read("compare")); }; load(); window.addEventListener("renova-saved", load); return () => window.removeEventListener("renova-saved", load); }, []);
  const card = (product: Product) => <article key={product.slug}><img src={product.imageUrl} alt="" loading="lazy"/><div><small>{product.brand || "Renova Select"}</small><h3>{product.name}</h3><Link href={`/products/${product.slug}`}>View product →</Link></div></article>;
  return <div className="saved-collections"><section><span className="eyebrow">Wishlist</span><h2>Saved for later</h2><div className="saved-grid">{wishlist.length ? wishlist.map(card) : <p>Products you save will appear here on this device.</p>}</div></section><section><span className="eyebrow">Recently viewed</span><h2>Continue exploring</h2><div className="saved-grid">{recent.length ? recent.map(card) : <p>Your recently viewed products will appear here.</p>}</div></section><section><span className="eyebrow">Comparison</span><h2>Compare up to three products</h2>{compare.length ? <div className="comparison-table">{compare.map((product) => <article key={product.slug}><img src={product.imageUrl} alt=""/><h3>{product.name}</h3><dl><dt>Brand</dt><dd>{product.brand || "Not specified"}</dd><dt>Model</dt><dd>{product.model || "Not specified"}</dd><dt>Availability</dt><dd>{product.stock > 0 ? "Available" : "Unavailable"}</dd><dt>Warranty</dt><dd>{product.warranty || "Not specified"}</dd></dl><Link href={`/products/${product.slug}`}>View product</Link></article>)}</div> : <p>Select Compare on any product to place it here.</p>}</section></div>;
}
