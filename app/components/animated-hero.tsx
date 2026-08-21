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
  const fallback = category.imageUrl || "/renova-hero.webp";
  const items = products.length ? products.slice(0, 5).map((product) => ({ imageUrl: product.imageUrl, label: product.name })) : (category.subcategories || [category.name]).slice(0, 5).map((label) => ({ imageUrl: fallback, label }));
  return <section className={`motion-hero collection-motion-hero accent-${category.accent}`}>
    <div className="collection-cinematic-bg" aria-hidden="true" style={{ backgroundImage: `url(${category.imageUrl || "/renova-hero.webp"})` }}/>
    <div className="cinematic-sweep" aria-hidden="true"><i/><i/><i/><i/></div>
    <div className="collection-watermark" aria-hidden="true">{category.monogram}</div>
    <div className="collection-motion-stage" aria-hidden="true">
      <div className="motion-ring ring-one"/><div className="motion-ring ring-two"/>
      {items.map((item, index) => <figure className={`collection-motion-card collection-card-${index + 1}`} key={`${item.label}-${index}`}><img src={item.imageUrl} alt="" loading={index < 2 ? "eager" : "lazy"}/><span>{String(index + 1).padStart(2, "0")}</span></figure>)}
    </div>
    <div className="collection-motion-copy"><i className="eyebrow">Renova collection</i><h1>{category.name}</h1><p>{category.description}, selected for clear choices and easier everyday shopping.</p>{category.subcategories && <div className="subcategory-pills" aria-label={`${category.name} subcategories`}>{category.subcategories.map((item) => <span key={item}>{item}</span>)}</div>}<div className="collection-pulse"><i/>Live collection</div></div>
  </section>;
}
