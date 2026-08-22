import type { Category, Product } from "../lib/catalog";

type HeroItem = { imageUrl: string; label: string };

export function AnimatedCatalogueHero({ items, query }: { items: HeroItem[]; query?: string }) {
  return <section className="motion-hero catalogue-motion-hero">
    <div className="motion-orbit" aria-hidden="true"><i/><i/><i/></div>
    <div className="motion-visuals" aria-hidden="true">{items.slice(0, 6).map((item, index) => <figure className={`motion-card card-${index + 1}`} key={`${item.label}-${index}`}><img src={item.imageUrl} alt="" loading={index < 2 ? "eager" : "lazy"}/><figcaption>{item.label}</figcaption></figure>)}</div>
    <div className="motion-copy"><span className="eyebrow">The Renova catalogue</span><h1>{query ? `Results for “${query}”` : "Find your everyday renewal."}</h1><p>Explore thoughtfully selected products across Renova’s complete Nigeria-first category structure.</p><span className="motion-note"><b>Always discovering</b><i/>Fresh finds move through Renova every day</span></div>
  </section>;
}

export function AnimatedCollectionHero({ category, products }: { category: Category; products: Product[] }) {
  const worldUrl = `/category-worlds/${category.slug}.webp`;
  return <section className={`motion-hero collection-motion-hero accent-${category.accent}`} data-world={category.slug}>
    <div className="collection-world-camera" aria-hidden="true"><img src={worldUrl} alt="" fetchPriority="high"/></div>
    <div className="collection-world-shade" aria-hidden="true"/>
    <div className="collection-world-effects" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
    <div className="collection-energy-rings" aria-hidden="true"><i/><i/><i/></div>
    <div className="collection-motion-copy"><i className="eyebrow">Renova collection</i><h1>{category.name}</h1><p>{category.description}, selected for clear choices and easier everyday shopping.</p>{category.subcategories && <div className="subcategory-pills" aria-label={`${category.name} subcategories`}>{category.subcategories.map((item) => <span key={item}>{item}</span>)}</div>}<div className="collection-pulse"><i/>Explore the collection</div></div>
    <div className="collection-world-index" aria-hidden="true"><b>{category.monogram}</b><span>Renova world</span></div>
  </section>;
}
