"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { categoryName, formatNaira, type Product } from "../lib/catalog";
import { CartDrawer, useCart } from "./cart-provider";
import { ProductAssistant } from "./product-assistant";
import { ShopperTools } from "./shopper-tools";

export function StoreHeader() {
  const { count, setCartOpen } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ name: string; slug: string; imageUrl: string }>>([]);
  useEffect(() => { if (searchQuery.trim().length < 2) { setSuggestions([]); return; } const timer = window.setTimeout(async () => { const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`); const payload = await response.json() as { suggestions?: Array<{ name: string; slug: string; imageUrl: string }> }; setSuggestions(payload.suggestions ?? []); }, 180); return () => window.clearTimeout(timer); }, [searchQuery]);
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open navigation">☰</button>
          <Link href="/" className="brand-lockup" aria-label="Renova home">
            <img src="/renova-mark.svg" alt="" />
            <span><strong>RENOVA</strong><small>Everyday finds, renewed.</small></span>
          </Link>
          <nav className={menuOpen ? "is-open" : ""} aria-label="Main navigation">
            <Link href="/shop">Shop all</Link><Link href="/collections/phones-tablets">Technology</Link><Link href="/collections/fashion">Style</Link><Link href="/collections/home-office">Home</Link><Link href="/collections/health-beauty">Beauty</Link>
          </nav>
          <div className="header-actions">
            <button className="header-action" onClick={() => setSearchOpen(!searchOpen)} aria-label="Search">⌕<span>Search</span></button>
            <Link href="/track-order" className="header-action">◎<span>Track</span></Link>
            <Link href="/saved" className="header-action">♡<span>Saved</span></Link>
            <button className="header-action cart-button" onClick={() => setCartOpen(true)} aria-label={`Open bag with ${count} items`}>◇<span>Bag</span>{count > 0 && <b>{count}</b>}</button>
          </div>
        </div>
        {searchOpen && <div className="search-shell"><form className="search-bar" action="/search"><label htmlFor="site-search">Search Renova</label><input id="site-search" name="q" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus autoComplete="off" placeholder="Try “portable blender” or “school bag”" /><button type="submit">Search</button></form>{suggestions.length > 0 && <div className="search-suggestions">{suggestions.map((item) => <Link key={item.slug} href={`/products/${item.slug}`} onClick={() => setSearchOpen(false)}><img src={item.imageUrl} alt="" loading="lazy"/><span>{item.name}</span><b>View →</b></Link>)}</div>}</div>}
      </header>
      <CartDrawer />
    </>
  );
}

export function StoreFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-story"><img src="/renova-mark.svg" alt="" /><div><strong>RENOVA</strong><p>Useful finds for everyday life, selected with a spirit of renewal.</p></div></div>
      <div className="footer-grid">
        <div><h3>Shop</h3><Link href="/shop">All products</Link><Link href="/collections/fashion">Fashion</Link><Link href="/collections/electronics">Electronics</Link><Link href="/collections/home-office">Home & office</Link></div>
        <div><h3>Help</h3><Link href="/track-order">Track an order</Link><Link href="/delivery">Delivery</Link><Link href="/returns">Returns & refunds</Link><a href="mailto:airebirth5@gmail.com">Email support</a></div>
        <div><h3>Renova</h3><Link href="/about">Our story</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/admin">Owner dashboard</Link></div>
        <div className="newsletter"><h3>Need a hand?</h3><p>For order or product support, email our customer care desk.</p><a href="mailto:airebirth5@gmail.com">airebirth5@gmail.com</a></div>
      </div>
      <div className="footer-bottom"><span>© 2026 Renova. Lagos, Nigeria.</span><span>Secure prepaid checkout powered by Paystack at launch.</span></div>
    </footer>
  );
}

export function StoreFrame({ children }: { children: React.ReactNode }) {
  return <><StoreHeader /><main>{children}</main><StoreFooter /><ProductAssistant /></>;
}

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const discount = product.compareAtKobo ? Math.round((1 - product.priceKobo / product.compareAtKobo) * 100) : 0;
  return (
    <article className="product-card">
      <Link href={`/products/${product.slug}`} className="product-image-wrap">
        <img src={product.imageUrl} alt={product.name} loading="lazy" />
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {discount > 0 && <span className="discount-badge">−{discount}%</span>}
      </Link>
      <div className="product-card-body">
        <span className="product-category">{categoryName(product.categorySlug)}</span>
        <Link href={`/products/${product.slug}`}><h3>{product.name}</h3></Link>
        {product.reviewCount > 0 ? (
          <div className="rating" aria-label={`${(product.rating / 10).toFixed(1)} out of 5 from ${product.reviewCount} reviews`}><span>★★★★★</span><small>{(product.rating / 10).toFixed(1)} ({product.reviewCount})</small></div>
        ) : (
          <div className="rating unrated" aria-label="New arrival with no reviews yet"><span>New arrival</span><small>No reviews yet</small></div>
        )}
        <div className="price-row"><strong>{formatNaira(product.priceKobo)}</strong>{product.compareAtKobo && <s>{formatNaira(product.compareAtKobo)}</s>}</div>
        <button className="quick-add" onClick={() => add(product)}>Quick add <span>＋</span></button>
        <ShopperTools product={product}/>
      </div>
    </article>
  );
}

function isVideo(url: string) {
  return /\.(mp4|webm)(?:\?|$)/i.test(url);
}

export function ProductGallery({ product }: { product: Product }) {
  const media = Array.from(new Set(product.gallery?.length ? product.gallery : [product.imageUrl]));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const selected = media[selectedIndex] ?? media[0] ?? product.imageUrl;
  const showPrevious = () => setSelectedIndex((current) => (current - 1 + media.length) % media.length);
  const showNext = () => setSelectedIndex((current) => (current + 1) % media.length);
  const finishSwipe = (clientX: number) => {
    if (touchStartX.current === null) return;
    const distance = clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 45 || media.length < 2) return;
    if (distance < 0) showNext(); else showPrevious();
  };
  return <div className="product-gallery">
    <div className="product-main-image" onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => finishSwipe(event.changedTouches[0]?.clientX ?? 0)}>
      {isVideo(selected) ? <video src={selected} controls playsInline preload="metadata"/> : <img src={selected} alt={`${product.name}, view ${selectedIndex + 1} of ${media.length}`}/>}
      {product.badge && <span>{product.badge}</span>}
      {media.length > 1 && <><button type="button" className="gallery-arrow gallery-previous" onClick={showPrevious} aria-label="View previous product image">‹</button><button type="button" className="gallery-arrow gallery-next" onClick={showNext} aria-label="View next product image">›</button><small className="gallery-count" aria-live="polite">{selectedIndex + 1} / {media.length}</small></>}
    </div>
    <div className="gallery-thumbs" aria-label={`${media.length} product images and videos`}>{media.map((url, index) => <button key={url} className={selectedIndex === index ? "active" : ""} onClick={() => setSelectedIndex(index)} aria-label={`View product media ${index + 1} of ${media.length}`} aria-current={selectedIndex === index ? "true" : undefined}>{isVideo(url) ? <span className="video-thumb">▶<small>Video</small></span> : <img src={url} alt={`${product.name} thumbnail ${index + 1}`}/>}<i>{index + 1}</i></button>)}</div>
    {media.length > 1 && <div className="gallery-dots" aria-hidden="true">{media.map((url, index) => <button type="button" key={url} className={selectedIndex === index ? "active" : ""} tabIndex={-1} onClick={() => setSelectedIndex(index)}/>)}</div>}
  </div>;
}

export function ReviewSubmission({ productSlug }: { productSlug: string }) {
  const [form, setForm] = useState({ reviewerName: "", rating: "5", title: "", body: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const response = await fetch("/api/reviews/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, productSlug }) });
    const payload = await response.json() as { message?: string; error?: string };
    setMessage(response.ok ? payload.message ?? "Review submitted." : payload.error ?? "Could not submit review.");
    if (response.ok) setForm({ reviewerName: "", rating: "5", title: "", body: "" });
    setSaving(false);
  }
  return <form className="customer-review-form" onSubmit={submit}><div><span className="eyebrow">Share your experience</span><h3>Review this product</h3><p>Reviews are moderated before they appear publicly.</p></div><label>Your name<input required value={form.reviewerName} onChange={(event) => setForm((current) => ({ ...current, reviewerName: event.target.value }))}/></label><label>Rating<select value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))}>{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>{rating} star{rating === 1 ? "" : "s"}</option>)}</select></label><label>Review title<input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}/></label><label>Review<textarea required minLength={10} rows={4} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}/></label><button className="button espresso" disabled={saving}>{saving ? "Submitting…" : "Submit review"}</button>{message && <small>{message}</small>}</form>;
}

export function ProductPurchase({ product }: { product: Product }) {
  const { add } = useCart();
  const [variant, setVariant] = useState(product.variants[0] ?? "Standard");
  const [quantity, setQuantity] = useState(1);
  return (
    <div className="purchase-panel">
      <div className="variant-block"><div className="field-head"><label>Choose option</label><span>{variant}</span></div><div className="variant-pills">{product.variants.map((item) => <button key={item} className={variant === item ? "is-selected" : ""} onClick={() => setVariant(item)}>{item}</button>)}</div></div>
      <div className="quantity-block"><label htmlFor="quantity">Quantity</label><div><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><input id="quantity" value={quantity} readOnly/><button onClick={() => setQuantity(Math.min(10, quantity + 1))}>+</button></div></div>
      <button className="button primary wide purchase-button" onClick={() => add(product, variant, quantity)}>Add to bag</button>
      <button className="button espresso wide" onClick={() => { add(product, variant, quantity); window.location.href = "/checkout"; }}>Buy now</button>
      <ShopperTools product={product} recordView/>
      <div className="purchase-trust"><span>✓ Prepaid secure checkout</span><span>✓ 3–5 working days</span><span>✓ Order tracking included</span></div>
    </div>
  );
}
