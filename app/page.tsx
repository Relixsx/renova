import Link from "next/link";
import { categories } from "./lib/catalog";
import { getProducts, getPublicReviews } from "./lib/server-catalog";
import { ProductCard, StoreFrame } from "./components/storefront";
import { CinematicHomeHero } from "./components/cinematic-home-hero";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [products, reviews] = await Promise.all([getProducts(), getPublicReviews(3)]);
  return (
    <StoreFrame>
      <CinematicHomeHero />

      <section className="trust-row emberline-trust" aria-label="Store assurances">
        <div><b>01</b><span><strong>Secure prepaid checkout</strong><small>Payments protected by Paystack</small></span></div>
        <div><b>02</b><span><strong>3–5 working days</strong><small>Clear delivery expectations</small></span></div>
        <div><b>03</b><span><strong>Track every order</strong><small>From payment to delivery</small></span></div>
        <div><b>04</b><span><strong>Email-first support</strong><small>support@shoprenova.com.ng</small></span></div>
      </section>

      <section className="section categories-section">
        <div className="section-head"><div><span className="eyebrow">Browse your way</span><h2>Everything, beautifully organised.</h2></div><Link href="/shop" className="text-link">View all categories →</Link></div>
        <div className="category-grid">
          {categories.map((category, index) => (
            <Link href={`/collections/${category.slug}`} className={`category-tile ${category.accent}`} key={category.slug}>
              <img className="category-image" src={category.imageUrl} alt={`${category.name} collection`} width="1200" height="900" loading="lazy" decoding="async" />
              <span className="category-overlay" />
              <span className="category-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="category-copy"><h3>{category.name}</h3><p>{category.description}</p></span>
              <i aria-hidden="true">↗</i>
            </Link>
          ))}
        </div>
      </section>

      <section className="section product-section">
        <div className="section-head"><div><span className="eyebrow">Selected by Renova</span><h2>Better finds. Clear choices.</h2></div><Link href="/shop" className="text-link">Shop the full edit →</Link></div>
        <div className="product-grid">{products.slice(0, 8).map((product) => <ProductCard key={product.slug} product={product} />)}</div>
      </section>

      <section className="editorial-banner">
        <div className="editorial-mark"><img src="/renova-mark.svg" alt="" /></div>
        <div><span className="eyebrow light">Renova philosophy</span><h2>Not more things.<br/><em>Better everyday choices.</em></h2><p>Our catalogue brings together practical products, clear information and a buying experience that feels calm from first click to delivery.</p><Link href="/about" className="button glass">Discover our story</Link></div>
        <blockquote>“Renew the ordinary.”</blockquote>
      </section>

      {reviews.length > 0 && <section className="section review-section">
        <div className="section-head"><div><span className="eyebrow">Customer experiences</span><h2>Thoughtful details, noticed.</h2></div></div>
        <div className="review-grid">
          {reviews.map((review) => (
            <article key={`${review.productSlug}-${review.reviewerName}`}><span className="stars">{"★".repeat(review.rating)}</span><h3>{review.title}</h3><p>“{review.body}”</p><footer><b>{review.reviewerName}</b><span>Renova customer</span></footer></article>
          ))}
        </div>
      </section>}

      <section className="closing-cta"><span className="eyebrow">Start somewhere new</span><h2>Your next favourite find<br/>may already be here.</h2><Link href="/shop" className="button primary">Shop Renova</Link></section>
    </StoreFrame>
  );
}
