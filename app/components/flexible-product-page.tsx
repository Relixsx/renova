"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  formatNaira,
  normalizeFlexibleProductPage,
  type Product,
  type Review,
} from "../lib/catalog";
import { ProductGallery, ProductPurchase, StoreFooter } from "./storefront";
import { ProductPromoBanner } from "./product-promo-banner";

function Countdown({ endsAt }: { endsAt: string }) {
  const deadline = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, deadline - Date.now()));
    const initialTimer = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [deadline]);
  if (!endsAt || !Number.isFinite(deadline)) return null;
  if (remaining === null)
    return <span className="flex-countdown" aria-hidden="true">--:--:--</span>;
  const total = Math.floor(remaining / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return (
    <span className="flex-countdown">
      {remaining
        ? `${days ? `${days}d ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : "Offer ended"}
    </span>
  );
}

function Media({ url, alt }: { url: string; alt: string }) {
  const video =
    /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("/video/upload/");
  return video ? (
    <video src={url} controls playsInline preload="metadata" aria-label={alt} />
  ) : (
    <img src={url} alt={alt} loading="lazy" />
  );
}

function EyebrowTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="flex-section-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}

export function FlexibleProductPage({
  product,
  reviews,
}: {
  product: Product;
  reviews: Review[];
}) {
  const config = normalizeFlexibleProductPage(product, product.landingPage);
  const genuineReviews = reviews.filter((review) => !review.isTestData);
  const style = {
    "--flex-bg": config.theme.background,
    "--flex-surface": config.theme.surface,
    "--flex-text": config.theme.text,
    "--flex-muted": config.theme.muted,
    "--flex-accent": config.theme.accent,
    "--flex-accent-two": config.theme.accentSecondary,
    "--flex-button": config.theme.buttonText,
  } as CSSProperties;
  const scrollToOrder = () =>
    document
      .getElementById("flex-order")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="flex-product-page" style={style}>
      <ProductPromoBanner
        enabled={product.promoEnabled}
        label={product.promoLabel}
        endsAt={product.promoEndsAt}
      />
      {config.announcement.enabled && (
        <div className="flex-announcement">
          <b>{config.announcement.text}</b>
          <span>{config.announcement.deliveryText}</span>
          {config.announcement.countdownEnabled && (
            <Countdown endsAt={config.announcement.endsAt} />
          )}
        </div>
      )}
      <nav className="flex-nav">
        <Link href="/" className="flex-brand">
          {config.navigation.brandLabel}
        </Link>
        {config.navigation.linksEnabled && (
          <div>
            <Link href="/shop">Shop</Link>
            <Link href="/track-order">Track order</Link>
            <Link href="/delivery">Delivery</Link>
          </div>
        )}
        <button onClick={scrollToOrder}>{config.navigation.ctaLabel}</button>
      </nav>
      {config.ticker.enabled && (
        <div className="flex-ticker">
          {config.ticker.items.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      )}

      <section className="flex-hero">
        <div className="flex-hero-copy">
          <span>{config.hero.eyebrow}</span>
          <h1>
            {config.hero.headline} <em>{config.hero.highlight}</em>
          </h1>
          <p>{config.hero.subtitle}</p>
          <div className="flex-price">
            <strong>{formatNaira(product.priceKobo)}</strong>
            {product.compareAtKobo && (
              <del>{formatNaira(product.compareAtKobo)}</del>
            )}
          </div>
          <button onClick={scrollToOrder}>{config.hero.ctaLabel}</button>
        </div>
        <div className="flex-hero-media">
          <Media
            url={config.hero.mediaUrl || product.imageUrl}
            alt={product.name}
          />
        </div>
      </section>

      {config.trust.enabled && (
        <section className="flex-card-row">
          {config.trust.items.map((item) => (
            <article key={item.title}>
              <b>{item.title}</b>
              <p>{item.text}</p>
            </article>
          ))}
        </section>
      )}
      {config.metrics.enabled && (
        <section className="flex-metrics">
          {config.metrics.items.map((item) => (
            <article key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </article>
          ))}
        </section>
      )}

      {config.gallery.enabled && (
        <section className="flex-content-section">
          <EyebrowTitle {...config.gallery} />
          <div className="flex-gallery">
            <ProductGallery product={product} />
          </div>
        </section>
      )}

      {config.problem.enabled && (
        <section className="flex-content-section flex-problem">
          <div>
            <EyebrowTitle
              eyebrow={config.problem.eyebrow}
              title={config.problem.title}
            />
            {config.problem.items.length > 0 && (
              <ul>
                {config.problem.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            <h3>{config.problem.solutionTitle}</h3>
            <p>{config.problem.solutionText}</p>
          </div>
          {config.problem.mediaUrl && (
            <Media
              url={config.problem.mediaUrl}
              alt={config.problem.solutionTitle}
            />
          )}
        </section>
      )}

      {config.features.enabled && (
        <section className="flex-content-section">
          <EyebrowTitle {...config.features} />
          <div className="flex-card-grid">
            {config.features.items.map((item) => (
              <article key={item.title}>
                <span>✓</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {config.process.enabled && (
        <section className="flex-content-section flex-process">
          <EyebrowTitle {...config.process} />
          <div className="flex-card-grid">
            {config.process.items.map((item, index) => (
              <article key={item.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {config.comparison.enabled && (
        <section className="flex-content-section">
          <EyebrowTitle
            eyebrow={config.comparison.eyebrow}
            title={config.comparison.title}
          />
          <div className="flex-comparison">
            <article>
              <h3>{config.comparison.beforeTitle}</h3>
              <ul>
                {config.comparison.beforeItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3>{config.comparison.afterTitle}</h3>
              <ul>
                {config.comparison.afterItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      )}

      {config.reviews.enabled && (
        <section className="flex-content-section">
          <EyebrowTitle {...config.reviews} />
          {genuineReviews.length ? (
            <div className="flex-review-grid">
              {genuineReviews.map((review) => (
                <article
                  key={review.id ?? `${review.reviewerName}-${review.title}`}
                >
                  <div className="flex-stars">{"★".repeat(review.rating)}</div>
                  <h3>{review.title}</h3>
                  <p>{review.body}</p>
                  <footer>
                    <b>{review.reviewerName}</b>
                    {review.isVerifiedPurchase && (
                      <span>Verified purchase</span>
                    )}
                    {review.reviewedAt && (
                      <time>
                        {new Date(review.reviewedAt).toLocaleDateString(
                          "en-NG",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </time>
                    )}
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <p className="flex-empty-reviews">No reviews yet.</p>
          )}
        </section>
      )}

      {config.offer.enabled && (
        <section className="flex-offer">
          <span>{config.offer.eyebrow}</span>
          <h2>{config.offer.title}</h2>
          <p>{config.offer.subtitle}</p>
          <strong>{formatNaira(product.priceKobo)}</strong>
          <small>{config.offer.stockMessage}</small>
          {config.offer.countdownEnabled && (
            <Countdown endsAt={config.offer.endsAt} />
          )}
          <button onClick={scrollToOrder}>{config.offer.ctaLabel}</button>
        </section>
      )}

      {config.order.enabled && (
        <section id="flex-order" className="flex-content-section flex-order">
          <EyebrowTitle
            eyebrow={config.order.eyebrow}
            title={config.order.title}
            subtitle={config.order.subtitle}
          />
          <ProductPurchase product={product} />
        </section>
      )}

      {config.faq.enabled && (
        <section className="flex-content-section">
          <EyebrowTitle {...config.faq} />
          <div className="flex-faq">
            {config.faq.items.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {config.finalCta.enabled && (
        <section className="flex-final-cta">
          <h2>
            {config.finalCta.title} <em>{config.finalCta.highlight}</em>
          </h2>
          <p>{config.finalCta.subtitle}</p>
          <button onClick={scrollToOrder}>{config.finalCta.buttonLabel}</button>
        </section>
      )}
      <StoreFooter />
      {config.stickyCta.enabled && (
        <button className="flex-sticky-cta" onClick={scrollToOrder}>
          {config.stickyCta.label} · {formatNaira(product.priceKobo)}
        </button>
      )}
    </div>
  );
}
