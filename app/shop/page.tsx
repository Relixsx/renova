import Link from "next/link";
import { ProductCard, StoreFrame } from "../components/storefront";
import { categories } from "../lib/catalog";
import { getProducts } from "../lib/server-catalog";
import { AnimatedCatalogueHero } from "../components/animated-hero";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Shop All Products", description: "Browse technology, fashion, beauty, home, appliances and everyday essentials available from Renova across Nigeria.", alternates: { canonical: "/shop" } };

export const dynamic = "force-dynamic";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; sort?: string; brand?: string; min?: string; max?: string; availability?: string; rating?: string; discount?: string }> }) {
  const params = await searchParams;
  let products = await getProducts({ query: params.q, categorySlug: params.category });
  if (params.sort === "price-low") products = [...products].sort((a, b) => a.priceKobo - b.priceKobo);
  if (params.sort === "price-high") products = [...products].sort((a, b) => b.priceKobo - a.priceKobo);
  if (params.brand) products = products.filter((product) => (product.brand || "Renova Select") === params.brand);
  if (params.min) products = products.filter((product) => product.priceKobo >= Number(params.min) * 100);
  if (params.max) products = products.filter((product) => product.priceKobo <= Number(params.max) * 100);
  if (params.availability === "in-stock") products = products.filter((product) => product.stock > 0);
  if (params.rating) products = products.filter((product) => product.rating >= Number(params.rating) * 10);
  if (params.discount === "yes") products = products.filter((product) => Boolean(product.compareAtKobo && product.compareAtKobo > product.priceKobo));
  const brands = Array.from(new Set((await getProducts()).map((product) => product.brand || "Renova Select"))).sort();
  const selectedCategory = categories.find((category) => category.slug === params.category);
  return <StoreFrame>
    <AnimatedCatalogueHero query={params.q} items={categories.slice(0, 8).map((category) => ({ imageUrl: category.imageUrl || "/renova-hero.webp", label: category.name }))}/>
    <section className="catalogue-layout">
      <aside className="catalogue-sidebar"><h2>Categories</h2><Link className={!params.category ? "active" : ""} href="/shop">All products <span>{products.length}</span></Link>{categories.map((category) => <Link className={params.category === category.slug ? "active" : ""} key={category.slug} href={`/shop?category=${category.slug}`}>{category.name}</Link>)}<form className="catalogue-filters"><h2>Refine</h2><input type="hidden" name="q" value={params.q ?? ""}/><input type="hidden" name="category" value={params.category ?? ""}/><label>Brand<select name="brand" defaultValue={params.brand ?? ""}><option value="">All brands</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></label><div><label>Min price<input name="min" type="number" min="0" defaultValue={params.min}/></label><label>Max price<input name="max" type="number" min="0" defaultValue={params.max}/></label></div><label>Availability<select name="availability" defaultValue={params.availability ?? ""}><option value="">Any</option><option value="in-stock">In stock</option></select></label><label>Rating<select name="rating" defaultValue={params.rating ?? ""}><option value="">Any rating</option><option value="4">4+ stars</option><option value="3">3+ stars</option></select></label><label className="filter-check"><input type="checkbox" name="discount" value="yes" defaultChecked={params.discount === "yes"}/> On offer</label><button>Apply filters</button></form></aside>
      <div className="catalogue-main"><div className="catalogue-bar"><span>{products.length} products</span><form><input type="hidden" name="q" value={params.q ?? ""}/><input type="hidden" name="category" value={params.category ?? ""}/><label>Sort<select name="sort" defaultValue={params.sort ?? "featured"}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label><button type="submit">Apply</button></form></div>{selectedCategory?.subcategories?.length ? <nav className="subcategory-chips" aria-label={`Popular ${selectedCategory.name} searches`}>{selectedCategory.subcategories.map((subcategory) => <Link key={subcategory} href={`/shop?category=${selectedCategory.slug}&q=${encodeURIComponent(subcategory)}`}>{subcategory}</Link>)}</nav> : null}{products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.slug} product={product}/>)}</div> : <div className="empty-state catalogue-empty"><span className="empty-mark">R</span><h2>No products match this selection.</h2><p>Try another category or clear your search to continue exploring.</p><Link href="/shop" className="button espresso">View all products</Link></div>}</div>
    </section>
  </StoreFrame>;
}
