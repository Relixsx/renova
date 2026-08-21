import Link from "next/link";
import { categories, seedReviews } from "./lib/catalog";
import { getProducts } from "./lib/server-catalog";
import { ProductCard, StoreFrame } from "./components/storefront";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getProducts();
  return (
    <StoreFrame>
      <section className="hero">
        <img src="/renova-hero.webp" alt="A warm editorial arrangement of Renova everyday products" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <span className="eyebrow light">The first Renova edit</span>
          <h1>Find something<br/><em>worth renewing.</em></h1>
          <p>Thoughtfully selected technology, style, beauty and home essentials for everyday life in Nigeria.</p>
          <div className="hero-actions"><Link className="button primary" href="/shop">Explore all finds</Link><Link className="button glass" href="/collections/home-office">Refresh your space</Link></div>
        </div>
        <div className="hero-note"><strong>Free Jumia Delivery</strong><span>On eligible campaign orders</span></div>
      </section>

      <section className="trust-row" aria-label="Store assurances">
        <div><b>01</b><span><strong>Secure prepaid checkout</strong><small>Paystack integration prepared</small></span></div>
        <div><b>02</b><span><strong>3–5 working days</strong><small>Clear delivery expectations</small></span></div>
        <div><b>03</b><span><strong>Track every order</strong><small>From payment to delivery</small></span></div>
        <div><b>04</b><span><strong>Email-first support</strong><small>airebirth5@gmail.com</small></span></div>
      </section>

      <section className="section categories-section">
        <div className="section-head"><div><span className="eyebrow">Browse your way</span><h2>Everything, beautifully organised.</h2></div><Link href="/shop" className="text-link">View all categories →</Link></div>
        <div className="category-grid">
          {categories.map((category, index) => (
            <Link href={`/collections/${category.slug}`} className={`category-tile ${category.accent}`} key={category.slug}>
              <img className="category-image" src={category.imageUrl} alt={`${category.name} collection`} loading="lazy" />
              <span className="category-overlay" />
              <span className="category-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="category-copy"><h3>{category.name}</h3><p>{category.description}</p></span>
              <i aria-hidden="true">↗</i>
            </Link>
          ))}
        </div>
      </section>

      <section className="section product-section">
        <div className="section-head"><div><span className="eyebrow">Curated now</span><h2>New energy for the everyday.</h2></div><Link href="/shop" className="text-link">Shop the full edit →</Link></div>
        <div className="product-grid">{products.slice(0, 8).map((product) => <ProductCard key={product.slug} product={product} />)}</div>
      </section>

      <section className="editorial-banner">
        <div className="editorial-mark"><img src="/renova-mark.svg" alt="" /></div>
        <div><span className="eyebrow light">Renova philosophy</span><h2>Not more things.<br/><em>Better everyday choices.</em></h2><p>Our catalogue is being shaped around practical products, clear information and a buying experience that feels calm from first click to delivery.</p><Link href="/about" className="button glass">Discover our story</Link></div>
        <blockquote>“Renew the ordinary.”</blockquote>
      </section>

      <section className="section review-section">
        <div className="section-head"><div><span className="eyebrow">Customer experiences</span><h2>Thoughtful details, noticed.</h2></div></div>
        <div className="review-grid">
          {seedReviews.slice(0, 3).map((review) => (
            <article key={`${review.productSlug}-${review.reviewerName}`}><span className="stars">★★★★★</span>{review.isTestData && <i className="sample-review-label">Presentation sample</i>}<h3>{review.title}</h3><p>“{review.body}”</p><footer><b>{review.reviewerName}</b><span>{review.isTestData ? "Demonstration content" : "Renova customer"}</span></footer></article>
          ))}
        </div>
      </section>

      <section className="closing-cta"><span className="eyebrow">Start somewhere new</span><h2>Your next favourite find<br/>may already be here.</h2><Link href="/shop" className="button primary">Shop Renova</Link></section>
    </StoreFrame>
  );
}
