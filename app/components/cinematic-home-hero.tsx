"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const particles = Array.from({ length: 18 }, (_, index) => ({
  x: (index * 37 + 11) % 96,
  y: (index * 61 + 17) % 88,
  delay: -(index % 9) * 0.72,
  duration: 7 + (index % 6) * 1.1,
  size: 2 + (index % 4),
}));

const products = [
  { src: "/products/nova-smartphone-white.webp", label: "Technology", className: "world-product-one" },
  { src: "/products/atelier-handbag-white.webp", label: "Style", className: "world-product-two" },
  { src: "/products/renew-serum.webp", label: "Beauty", className: "world-product-three" },
  { src: "/products/ember-blender-white.webp", label: "Home", className: "world-product-four" },
];

export function CinematicHomeHero() {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      hero.style.setProperty("--pointer-x", `${((event.clientX - rect.left) / rect.width - 0.5) * 2}`);
      hero.style.setProperty("--pointer-y", `${((event.clientY - rect.top) / rect.height - 0.5) * 2}`);
    };
    const reset = () => {
      hero.style.setProperty("--pointer-x", "0");
      hero.style.setProperty("--pointer-y", "0");
    };
    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerleave", reset);
    return () => {
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", reset);
    };
  }, []);

  return (
    <section className="cinematic-home-hero" ref={heroRef}>
      <div className="world-camera" aria-hidden="true">
        <img className="world-background" src="/renova-cinematic-world-hd.webp" alt="" fetchPriority="high" />
        <div className="world-depth world-depth-far" />
        <div className="world-depth world-depth-near" />
        <div className="world-light-trail trail-one" />
        <div className="world-light-trail trail-two" />
        <div className="world-products">
          {products.map((product, index) => (
            <figure className={`world-product ${product.className}`} key={product.label}>
              <span className="world-product-halo" />
              <img src={product.src} alt="" />
              <figcaption><b>{String(index + 1).padStart(2, "0")}</b>{product.label}</figcaption>
            </figure>
          ))}
        </div>
        <div className="world-particles">
          {particles.map((particle, index) => <i key={index} style={{ left: `${particle.x}%`, top: `${particle.y}%`, width: particle.size, height: particle.size, animationDelay: `${particle.delay}s`, animationDuration: `${particle.duration}s` }} />)}
        </div>
      </div>

      <div className="cinematic-hero-shade" />
      <div className="cinematic-hero-copy">
        <span className="eyebrow light">Enter the Renova world</span>
        <h1>Find something<br/><em>worth renewing.</em></h1>
        <span className="hero-emberline" aria-hidden="true"><i /><i /><i /></span>
        <p>Thoughtfully selected technology, style, beauty and home essentials, moving through one extraordinary marketplace.</p>
        <div className="hero-actions">
          <Link className="button primary" href="/shop">Explore all finds</Link>
          <Link className="button glass" href="/collections/home-office">Refresh your space</Link>
        </div>
        <div className="world-status"><i /><span><b>Renova world is live</b>Move your cursor to explore</span></div>
      </div>
      <div className="hero-note"><strong>Free Jumia Delivery</strong><span>On eligible campaign orders</span></div>
      <div className="world-scroll-cue" aria-hidden="true"><span>Discover</span><i /></div>
      <div className="hero-white-transition" aria-hidden="true" />
    </section>
  );
}
