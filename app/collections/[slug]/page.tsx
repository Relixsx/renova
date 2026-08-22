import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard, StoreFrame } from "../../components/storefront";
import { categories } from "../../lib/catalog";
import { getProducts } from "../../lib/server-catalog";
import { AnimatedCollectionHero } from "../../components/animated-hero";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = categories.find((item) => item.slug === slug);
  if (!category) return { title: "Collection not found", robots: { index: false, follow: false } };
  return { title: category.name, description: `${category.description}. Browse current ${category.name.toLowerCase()} products at Renova.`, alternates: { canonical: `/collections/${category.slug}` }, openGraph: { title: `${category.name} | Renova`, description: category.description, url: `/collections/${category.slug}`, images: category.imageUrl ? [{ url: category.imageUrl, alt: `${category.name} collection` }] : undefined } };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();
  const products = await getProducts({ categorySlug: slug });
  return <StoreFrame><AnimatedCollectionHero category={category} products={products}/><section className="section"><div className="section-head"><div><span className="eyebrow">{products.length} current finds</span><h2>Browse {category.name.toLowerCase()}.</h2></div><Link href="/shop" className="text-link">Return to all products →</Link></div>{products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.slug} product={product}/>)}</div> : <div className="empty-state catalogue-empty"><span className="empty-mark">{category.monogram}</span><h2>No active products in this collection.</h2><p>Browse the wider Renova catalogue to find currently available products.</p><Link href="/shop" className="button espresso">Browse all products</Link></div>}</section></StoreFrame>;
}
