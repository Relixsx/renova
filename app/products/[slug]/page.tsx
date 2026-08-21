import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard, ProductGallery, ProductPurchase, ReviewSubmission, StoreFrame } from "../../components/storefront";
import { categoryName, formatNaira } from "../../lib/catalog";
import { getProduct, getProducts, getReviews } from "../../lib/server-catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product not found", robots: { index: false, follow: false } };
  return {
    title: product.name,
    description: product.shortDescription,
    openGraph: { title: product.name, description: product.shortDescription, images: [{ url: product.imageUrl, alt: product.name }] },
    twitter: { card: "summary_large_image", title: product.name, description: product.shortDescription, images: [product.imageUrl] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const [reviews, allProducts] = await Promise.all([getReviews(slug), getProducts()]);
  const related = allProducts.filter((item) => item.slug !== slug && (item.categorySlug === product.categorySlug || item.isFeatured)).slice(0, 4);
  const discount = product.compareAtKobo ? Math.round((1 - product.priceKobo / product.compareAtKobo) * 100) : 0;
  const genuineReviews = reviews.filter((review) => !review.isTestData);
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: product.name, image: product.gallery?.length ? product.gallery : [product.imageUrl], description: product.shortDescription, sku: product.sku, brand: { "@type": "Brand", name: product.brand || "Renova Select" }, offers: { "@type": "Offer", priceCurrency: "NGN", price: (product.priceKobo / 100).toFixed(2), availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `/products/${product.slug}` }, ...(genuineReviews.length ? { aggregateRating: { "@type": "AggregateRating", ratingValue: (genuineReviews.reduce((sum, review) => sum + review.rating, 0) / genuineReviews.length).toFixed(1), reviewCount: genuineReviews.length } } : {}) };
  const details = [["Brand", product.brand], ["Model", product.model], ["Materials", product.materials], ["Dimensions", product.dimensions], ["Weight", product.weight], ["Colour", product.colour], ["Size", product.size], ["Warranty", product.warranty], ["Country of origin", product.countryOfOrigin], ["Compatibility", product.compatibility], ...Object.entries(product.specifications ?? {})].filter((item) => item[1]);
  return <StoreFrame>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}/>
    <nav className="breadcrumbs"><Link href="/">Home</Link><span>›</span><Link href={`/collections/${product.categorySlug}`}>{categoryName(product.categorySlug)}</Link><span>›</span><b>{product.name}</b></nav>
    <section className="product-detail">
      <ProductGallery product={product}/>
      <div className="product-info"><span className="product-category">{categoryName(product.categorySlug)} · {product.sku}</span><h1>{product.name}</h1>{product.reviewCount > 0 ? <div className="product-rating"><span>★★★★★</span><a href="#reviews">{(product.rating / 10).toFixed(1)} · {product.reviewCount} reviews</a></div> : <div className="product-rating unrated"><span>New arrival</span><a href="#reviews">No reviews yet</a></div>}<div className="detail-price"><strong>{formatNaira(product.priceKobo)}</strong>{product.compareAtKobo && <s>{formatNaira(product.compareAtKobo)}</s>}{discount > 0 && <span>Save {discount}%</span>}</div><p className="product-lead">{product.shortDescription}</p><div className="stock-line"><span className={product.stock > 0 ? "in-stock" : "out-stock"}/><b>{product.stock > 0 ? "Available and ready to order" : "Currently unavailable"}</b></div><ProductPurchase product={product}/><div className="product-accordions"><details open><summary>Product description <span>＋</span></summary><p>{product.description}</p></details><details><summary>Delivery information <span>＋</span></summary><p>Estimated delivery is 3–5 working days. Eligible Jumia campaign delivery may be free; other courier rates will be shown before payment.</p></details><details><summary>Returns & refunds <span>＋</span></summary><p>Return eligibility depends on the item condition and the published Renova policy. No hidden conditions will be introduced at checkout.</p></details></div></div>
    </section>
    {(details.length > 0 || product.packageContents || product.careInstructions) && <section className="section product-specifications"><div className="section-head"><div><span className="eyebrow">Product details</span><h2>Everything worth knowing.</h2></div></div>{details.length > 0 && <dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}<div className="spec-notes">{product.packageContents && <article><h3>What is in the box</h3><p>{product.packageContents}</p></article>}{product.careInstructions && <article><h3>Care instructions</h3><p>{product.careInstructions}</p></article>}</div></section>}
    <section className="product-highlights"><article><b>01</b><h3>Clear information</h3><p>Price, variant and delivery choices are visible before payment.</p></article><article><b>02</b><h3>Verified payment state</h3><p>Orders will be marked paid only after Paystack server verification.</p></article><article><b>03</b><h3>Human fulfilment</h3><p>Every paid order enters the owner’s fulfilment checklist.</p></article></section>
    <section className="section product-reviews" id="reviews"><div className="section-head"><div><span className="eyebrow">Customer reviews</span><h2>What shoppers are saying.</h2></div></div>{reviews.length ? <div className="review-grid">{reviews.map((review) => <article key={`${review.id ?? review.reviewerName}-${review.productSlug}`}><span className="stars">{"★".repeat(review.rating)}</span>{review.isTestData && <i className="sample-review-label">Presentation sample</i>}<h3>{review.title}</h3><p>“{review.body}”</p><footer><b>{review.reviewerName}</b><span>{review.isTestData ? "Demonstration content" : "Renova customer"}</span></footer></article>)}</div> : <div className="empty-state catalogue-empty"><h2>No reviews yet.</h2><p>Be the first to share your experience with this product.</p></div>}<ReviewSubmission productSlug={product.slug}/></section>
    {related.length > 0 && <section className="section related-products"><div className="section-head"><div><span className="eyebrow">Continue exploring</span><h2>You may also like.</h2></div></div><div className="product-grid">{related.map((item) => <ProductCard key={item.slug} product={item}/>)}</div></section>}
  </StoreFrame>;
}
