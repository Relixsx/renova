import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ProductCard,
  ProductGallery,
  ProductPurchase,
  ReviewSubmission,
  StoreFrame,
} from "../../components/storefront";
import { ProductDeliveryCard } from "../../components/product-confidence";
import { ProductMetaTracker } from "../../components/product-meta-tracker";
import { ProductPromoBanner } from "../../components/product-promo-banner";
import { categoryName, formatNaira, productHref } from "../../lib/catalog";
import { getProduct, getProducts, getReviews } from "../../lib/server-catalog";
import { absoluteUrl, SUPPORT_EMAIL } from "../../lib/site";
import { formatReviewDate } from "../../lib/review-display";

export const dynamic = "force-dynamic";

function formatSoldCount(value: number) {
  const count = Math.max(0, Math.floor(value));

  if (count >= 1_000_000) {
    const amount = count / 1_000_000;
    return `${amount.toFixed(amount >= 10 ? 0 : 1).replace(/\.0$/, "")}M+ sold`;
  }

  if (count >= 1_000) {
    const amount = count / 1_000;
    return `${amount.toFixed(amount >= 10 ? 0 : 1).replace(/\.0$/, "")}K+ sold`;
  }

  return `${count.toLocaleString("en-NG")} sold`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product)
    return {
      title: "Product not found",
      robots: { index: false, follow: false },
    };
  return {
    title: product.name,
    description: product.shortDescription,
    alternates: { canonical: productHref(product) },
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      url: productHref(product),
      type: "website",
      images: [{ url: absoluteUrl(product.imageUrl), alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: product.shortDescription,
      images: [absoluteUrl(product.imageUrl)],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  if (product.pageTemplate === "flexible") redirect(`/offers/${product.slug}`);
  const [reviews, allProducts] = await Promise.all([
    getReviews(slug),
    getProducts(),
  ]);
  const related = allProducts
    .filter(
      (item) =>
        item.slug !== slug &&
        (item.categorySlug === product.categorySlug || item.isFeatured),
    )
    .slice(0, 4);
  const discount = product.compareAtKobo
    ? Math.round((1 - product.priceKobo / product.compareAtKobo) * 100)
    : 0;
  const genuineReviews = reviews.filter((review) => !review.isTestData);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: (product.gallery?.length ? product.gallery : [product.imageUrl]).map(
      absoluteUrl,
    ),
    description: product.shortDescription,
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brand || "Renova Select" },
    offers: {
      "@type": "Offer",
      priceCurrency: "NGN",
      price: (product.priceKobo / 100).toFixed(2),
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: absoluteUrl(productHref(product)),
      seller: {
        "@type": "Organization",
        name: "Renova Store",
        url: absoluteUrl(),
      },
    },
    ...(genuineReviews.length
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: (
              genuineReviews.reduce((sum, review) => sum + review.rating, 0) /
              genuineReviews.length
            ).toFixed(1),
            reviewCount: genuineReviews.length,
          },
        }
      : {}),
  };
  const details = [
    ["Brand", product.brand],
    ["Model", product.model],
    ["Materials", product.materials],
    ["Dimensions", product.dimensions],
    ["Weight", product.weight],
    ["Colour", product.colour],
    ["Size", product.size],
    ["Warranty", product.warranty],
    ["Country of origin", product.countryOfOrigin],
    ["Compatibility", product.compatibility],
    ...Object.entries(product.specifications ?? {}),
  ].filter((item) => item[1]);
  return (
    <StoreFrame>
      <ProductMetaTracker
        slug={product.slug}
        name={product.name}
        value={product.priceKobo / 100}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <nav className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>›</span>
        <Link href={`/collections/${product.categorySlug}`}>
          {categoryName(product.categorySlug)}
        </Link>
        <span>›</span>
        <b>{product.name}</b>
      </nav>
      <section className="product-detail">
        <ProductGallery product={product} />
        <div className="product-info">
          <ProductPromoBanner
            enabled={product.promoEnabled}
            label={product.promoLabel}
            endsAt={product.promoEndsAt}
          />
          <span className="product-category">
            {categoryName(product.categorySlug)} · {product.sku}
          </span>
          <h1>{product.name}</h1>
          {product.reviewCount > 0 ? (
            <div className="product-rating">
              <span className="product-rating-stars" aria-hidden="true">
                ★★★★★
              </span>
              <a href="#reviews">
                <b>{(product.rating / 10).toFixed(1)}</b>
                <span>· {product.reviewCount} reviews</span>
              </a>
              {Number(product.soldCount) > 0 && (
                <strong className="product-sold-count">
                  {formatSoldCount(Number(product.soldCount))}
                </strong>
              )}
            </div>
          ) : (
            <div className="product-rating unrated">
              <span>New arrival</span>
              <a href="#reviews">No reviews yet</a>
              {Number(product.soldCount) > 0 && (
                <strong className="product-sold-count">
                  {formatSoldCount(Number(product.soldCount))}
                </strong>
              )}
            </div>
          )}
          <div className="product-price-block">
            <div className="detail-price">
              <strong>{formatNaira(product.priceKobo)}</strong>
              {product.compareAtKobo && (
                <s>{formatNaira(product.compareAtKobo)}</s>
              )}
              {discount > 0 && <span>Save {discount}%</span>}
            </div>
            <div className="product-free-delivery-pill" role="note">
              Free delivery
            </div>
          </div>
          <p className="product-lead">{product.shortDescription}</p>
          <div className="stock-line">
            <span className={product.stock > 0 ? "in-stock" : "out-stock"} />
            <b>
              {product.stock > 0
                ? "Available and ready to order"
                : "Currently unavailable"}
            </b>
          </div>
          <div
            className="product-return-highlight"
            aria-label="Seven-day return information"
          >
            <span className="product-return-icon" aria-hidden="true">
              ↻
            </span>
            <div>
              <b>7-day return request</b>
              <small>Eligible items · conditions apply</small>
            </div>
            <Link href="/returns">
              View details <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div
            className="renova-assurance-grid"
            aria-label="Purchase assurances"
          >
            <article>
              <i aria-hidden="true">✓</i>
              <span>
                <b>
                  {product.paymentMode === "cash_on_delivery"
                    ? "Payment on delivery"
                    : "Secure payment"}
                </b>
                <small>
                  {product.paymentMode === "cash_on_delivery"
                    ? "Pay when your order arrives"
                    : "Verified securely by Paystack"}
                </small>
              </span>
            </article>
            <article>
              <i aria-hidden="true">↗</i>
              <span>
                <b>Tracked delivery</b>
                <small>Estimated in 3–5 working days</small>
              </span>
            </article>
            <article>
              <i aria-hidden="true">↻</i>
              <span>
                <b>7-day return request</b>
                <small>Subject to published eligibility rules</small>
              </span>
            </article>
          </div>
          <ProductPurchase product={product} />
          <ProductDeliveryCard available={product.stock > 0} />
          <div className="product-accordions">
            <details open>
              <summary>
                Product description <span>＋</span>
              </summary>
              <p>{product.description}</p>
            </details>
            <details>
              <summary>
                Delivery information <span>＋</span>
              </summary>
              <p>
                Estimated delivery is 3–5 working days after order confirmation.
                Eligible Jumia campaign delivery may be free; every available
                carrier and charge is shown before the order is placed.
              </p>
            </details>
            <details>
              <summary>
                Returns & refunds <span>＋</span>
              </summary>
              <p>
                Eligible items may be requested for return within seven calendar
                days after delivery. The item must satisfy the condition
                requirements in the published Renova policy.
              </p>
            </details>
          </div>
        </div>
      </section>
      {(details.length > 0 ||
        product.packageContents ||
        product.careInstructions) && (
        <section className="section product-specifications">
          <div className="section-head">
            <div>
              <span className="eyebrow">Product details</span>
              <h2>Everything worth knowing.</h2>
            </div>
          </div>
          {details.length > 0 && (
            <dl>
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="spec-notes">
            {product.packageContents && (
              <article>
                <h3>What is in the box</h3>
                <p>{product.packageContents}</p>
              </article>
            )}
            {product.careInstructions && (
              <article>
                <h3>Care instructions</h3>
                <p>{product.careInstructions}</p>
              </article>
            )}
          </div>
        </section>
      )}
      <section className="section product-questions">
        <div className="section-head">
          <div>
            <span className="eyebrow">Product questions</span>
            <h2>Answers before you order.</h2>
          </div>
          <a
            className="text-link"
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Question about ${product.name}`)}`}
          >
            Ask customer care →
          </a>
        </div>
        <div className="question-grid">
          {(product.chatbotFaq?.length
            ? product.chatbotFaq
            : [
                {
                  question: "When should this product arrive?",
                  answer:
                    "The standard estimate is 3–5 working days after verified payment. The selected carrier and any applicable charge are confirmed during checkout.",
                },
                {
                  question: "How do I know whether my payment succeeded?",
                  answer:
                    "Renova marks an order paid only after Paystack server verification, then displays the confirmation page and sends the order email.",
                },
                {
                  question: "Can I request a return?",
                  answer:
                    "Eligible items may be requested for return within seven calendar days after delivery, subject to the published item-condition requirements.",
                },
              ]
          ).map((item) => (
            <details key={item.question}>
              <summary>
                {item.question}
                <span>＋</span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="product-highlights">
        <article>
          <b>01</b>
          <h3>Clear information</h3>
          <p>Price, variant and delivery choices are visible before payment.</p>
        </article>
        <article>
          <b>02</b>
          <h3>Verified payment state</h3>
          <p>
            Orders will be marked paid only after Paystack server verification.
          </p>
        </article>
        <article>
          <b>03</b>
          <h3>Human fulfilment</h3>
          <p>Every paid order enters the owner’s fulfilment checklist.</p>
        </article>
      </section>
      <section className="section product-reviews" id="reviews">
        <div className="section-head">
          <div>
            <span className="eyebrow">Customer reviews</span>
            <h2>What shoppers are saying.</h2>
          </div>
        </div>
        {reviews.length ? (
          <div className="review-grid">
            {reviews.map((review) => {
              const reviewDate = formatReviewDate(review);
              return (
                <article
                  key={`${review.id ?? review.reviewerName}-${review.productSlug}`}
                >
                  <span className="stars">{"★".repeat(review.rating)}</span>
                  <h3>{review.title}</h3>
                  <p>“{review.body}”</p>
                  <footer>
                    <b>{review.reviewerName}</b>
                    <span className="review-meta">
                      {review.isVerifiedPurchase && (
                        <em className="verified-purchase">
                          ✓ Verified purchase
                        </em>
                      )}
                      {reviewDate && (
                        <time dateTime={review.reviewedAt ?? review.createdAt}>
                          {reviewDate}
                        </time>
                      )}
                    </span>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state catalogue-empty">
            <h2>No reviews yet.</h2>
            <p>Be the first to share your experience with this product.</p>
          </div>
        )}
        <ReviewSubmission productSlug={product.slug} />
      </section>
      {related.length > 0 && (
        <section className="section related-products">
          <div className="section-head">
            <div>
              <span className="eyebrow">Continue exploring</span>
              <h2>You may also like.</h2>
            </div>
          </div>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard key={item.slug} product={item} />
            ))}
          </div>
        </section>
      )}
    </StoreFrame>
  );
}
