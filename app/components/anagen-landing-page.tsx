import type { Metadata } from "next";
import Link from "next/link";
import { AnagenOrderForm, AnagenBundleLink } from "./anagen-order-form";
import { AnagenComparisonGallery } from "./anagen-comparison-gallery";
import { ProductMetaTracker } from "./product-meta-tracker";
import { ANAGEN } from "../lib/anagen-offer.mjs";
import { absoluteUrl } from "../lib/site";
import styles from "../anagen/anagen.module.css";

type LandingPath = "/anagen" | "/anagen2";

export function anagenLandingMetadata(path: LandingPath): Metadata {
  return {
  title: "Anagen Hair Reviver",
  description: "Discover Anagen herbal hair treatment at Renova. Two sachets and an application guide in each pack. From ₦11,200 with free doorstep delivery and payment on delivery.",
  alternates: { canonical: path },
  openGraph: { title: "Anagen Hair Reviver | Renova", description: "Choose your Anagen package. Free doorstep delivery and payment on delivery.", url: path, type: "website", images: [{ url: absoluteUrl("/anagen/product-studio.webp"), alt: "Anagen Hair Reviver silver pack on white" }] },
  twitter: { card: "summary_large_image", title: "Anagen Hair Reviver | Renova", description: "Herbal hair care, delivered by Renova.", images: [absoluteUrl("/anagen/product-studio.webp")] },
  };
}

function Icon({ name }: { name: "leaf" | "truck" | "spark" | "check" | "box" | "shield" | "arrow" }) {
  const paths = {
    leaf: "M20 4C11 2 3 7 5 14c1 5 8 7 12 2 3-4 3-9 3-12ZM4 21l11-11",
    truck: "M2 5h12v12H2zM14 9h4l4 4v4h-8M5 17a2 2 0 1 0 4 0M16 17a2 2 0 1 0 4 0",
    spark: "m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z",
    check: "M20 6 9 17l-5-5",
    box: "m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4",
    shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6",
    arrow: "M6 18 18 6M6 6h12v12",
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

const ingredients = [
  ["Fenugreek Seed", "Methi", "Rich in protein and nicotinic acid to support stronger strands and a fuller-looking head of hair."],
  ["Amla Berry", "Indian Gooseberry", "A traditional botanical ingredient rich in vitamin C and antioxidants."],
  ["Moringa Powder", "Moringa Oleifera", "A nutrient-rich leaf powder selected to nourish hair roots and complement your hair-care routine."],
  ["Rosemary Powder", "Rosmarinus Officinalis", "A familiar scalp-care botanical, blended with the other natural ingredients."],
  ["Other Natural Ingredients", "Organic herbal blend", "Carefully selected botanical ingredients in a concentrated solid blend."],
];
const benefits = [
  ["Restores edges", "For receding hairlines, sparse edges and a fuller-looking finish."],
  ["Helps reduce breakage", "Nourishes the hair shaft as part of a consistent hair-care routine."],
  ["Supports new growth", "A concentrated blend for your hair-growth journey."],
  ["Scalp care", "A herbal addition to your regular scalp-care routine."],
  ["Deep nourishment", "Mix directly with the hair cream or oil you already use."],
  ["Versatile hair care", "For natural hair, relaxed hair, dreadlocks and beard care."],
];

export function AnagenLandingPage({ variant, path }: { variant: "gold" | "lime"; path: LandingPath }) {
  const supportPhone = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: ANAGEN.name, sku: ANAGEN.sku, brand: { "@type": "Brand", name: "Anagen" }, description: "10g herbal hair-care blend; two sachets and an application guide per pack.", image: [absoluteUrl("/anagen/product-studio.webp"), absoluteUrl("/anagen/ari.jpg")], offers: { "@type": "Offer", url: absoluteUrl(path), price: "11200.00", priceCurrency: "NGN" } };
  return <main className={`${styles.page}${variant === "lime" ? ` ${styles.limeTheme}` : ""}`} data-anagen-theme={variant}>
    <ProductMetaTracker slug={ANAGEN.slug} name={ANAGEN.name} value={11200} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <div className={styles.announcement}><Icon name="truck" /><span><strong>TODAY / <span className={styles.deliveryHeadline}>24-HOUR DELIVERY</span></strong><small>State capitals · subject to address &amp; dispatch confirmation</small></span></div>
    <header className={styles.navigation}><div className={styles.container}><Link className={styles.wordmark} href={path}>Ana<span>gen</span><small>Available at Renova</small></Link><nav aria-label="Anagen navigation"><Link href="/shop" className={styles.storeLink}>Visit Renova <Icon name="arrow" /></Link><a href="#order-form" className={styles.button}>Order now</a></nav></div></header>

    <section className={styles.hero}><div className={`${styles.container} ${styles.heroGrid}`}>
      <div className={styles.heroIntro}><span className={styles.heroBadge}><Icon name="leaf" /> 100% natural herbal formula</span><p className={styles.heroEyebrow}>Anagen Hair Reviver</p></div>
      <h1 className={styles.heroHeading}>Reclaim your edge.<br />Embrace your strand in just <em>14 days.</em></h1>
      <figure className={styles.heroMedia}><div className={styles.imageFrame}><img src="/anagen/product-studio.webp" alt="Anagen Hair Reviver silver resealable pack with herbal sachets, presented on a white background" width="1024" height="1024" loading="eager" fetchPriority="high" decoding="async" /></div><figcaption>2 sachets + application guide in every pack</figcaption></figure>
      <p className={styles.heroCopy}>Give your hair a fresh start with Anagen — a potent mix of traditional herbs in solid form. Mix it directly with your preferred hair cream or oil.</p>
      <div className={styles.heroIngredients}><strong>Pure herbal hair food. No water or fillers.</strong><p>🌱 Fenugreek &amp; amla for stronger, fuller-looking hair</p><p>🌿 Rosemary &amp; moringa for your scalp-care routine</p><small>A concentrated blend. A little goes a long way.</small></div>
      <div className={styles.heroPurchase}>
        <AnagenBundleLink packs={1} className={styles.heroButton}>Get yours today — ₦11,200 <Icon name="arrow" /></AnagenBundleLink><div className={styles.heroTrust}><span><Icon name="check" /> Pay on delivery</span><span><Icon name="check" /> Free doorstep shipping</span></div>
      </div>
    </div></section>

    <section className={styles.badgeStrip} aria-label="Anagen highlights"><div className={styles.container}>{([
      ["leaf", "Natural blend", "Traditional botanical ingredients"], ["spark", "14-day results", "Supplier-reported visible changes"], ["box", "Easy to use", "Mix with your hair cream or oil"], ["shield", "For men & women", "Hair and beard care"],
    ] as const).map(([icon,title,description]) => <article key={title}><Icon name={icon} /><h2>{title}</h2><p>{description}</p></article>)}</div></section>

    <section className={`${styles.section} ${styles.container}`}><div className={styles.valueBanner}><Icon name="box" /><div><span className={styles.yellowLabel}>No half measures</span><h2>Why every pack contains 2 sachets.</h2><p>Each Anagen pack comes with <strong>two sachets of natural hair mix</strong>, plus a printed application guide. You receive the full pack — ready to add to the hair-care routine you already know.</p></div></div></section>

    <section className={`${styles.section} ${styles.container}`} id="about-anagen"><header className={styles.sectionIntro}><p className={styles.eyebrow}>A closer look</p><h2>What makes Anagen so special?</h2><p>A 10g concentrated mix of traditional herbs, made to fit into your everyday hair-care routine.</p></header><div className={styles.productDetails}><img src="/anagen/anagenraw.jpg" alt="A closer look at the Anagen hair-care blend" width="800" height="800" loading="lazy" decoding="async" /><div>{[
      ["Versatile application", "Mix Anagen with your preferred hair cream, pomade or oil. Follow the application guide included in your pack."],
      ["Pure organic goodness", "A solid herbal blend with no added water or fillers. A little goes a long way."],
      ["14-day visible results", "Our supplier reports visible baby hair and fuller-looking growth within two weeks of consistent use. Individual results vary."],
    ].map(([title,body]) => <article key={title}><span><Icon name="leaf" /></span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div></div></section>

    <section className={`${styles.section} ${styles.ingredientsSection}`} id="anagen-ingredients"><div className={styles.container}><header className={styles.sectionIntro}><p className={styles.eyebrow}>Natural ingredients</p><h2>Powered by traditional herbs.</h2><p>The botanical ingredients behind your Anagen blend.</p></header><div className={styles.ingredientGrid}>{ingredients.map(([title,subtitle,body]) => <article key={title}><span><Icon name="leaf" /></span><h3>{title}</h3><small>{subtitle}</small><p>{body}</p></article>)}</div></div></section>

    <section className={`${styles.section} ${styles.container}`}><div className={styles.benefits}><header className={styles.sectionIntro}><p className={styles.eyebrow}>Your hair-care journey</p><h2>The benefits, at a glance.</h2></header><div>{benefits.map(([title,body]) => <article key={title}><Icon name="check" /><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>

    <section className={styles.resultsSection}><div className={styles.container}><header className={styles.sectionIntro}><p className={styles.eyebrow}>Results shared by our supplier</p><h2>Before &amp; after.</h2><p>A look at the results and feedback included with the Anagen supplier materials.</p></header><div className={styles.resultsGrid}>{[
      ["hair2.jpg", "My front edges grew back after mixing Anagen with my hair butter."], ["hair1.jpg", "Stopped my severe hair issue within a few weeks."], ["hair3.jpg", "Hair growth filled up completely. Very solid natural product."],
    ].map(([file,quote],index) => <figure key={file}><img src={`/anagen/${file}`} alt={`Supplier-provided Anagen result ${index + 1}`} width="600" height="500" loading="lazy" decoding="async" /><figcaption>“{quote}”</figcaption></figure>)}</div><p className={styles.resultsNote}>Supplier-provided images and testimonials. Individual results vary.</p></div></section>

    <AnagenComparisonGallery />

    <section className={`${styles.section} ${styles.container}`} id="packages"><header className={styles.sectionIntro}><p className={styles.eyebrow}>Special promo offer</p><h2>Choose your Anagen package.</h2><p>Free doorstep delivery with every package. Pay when you receive it.</p></header><div className={styles.packageGrid}>{ANAGEN.bundles.map((offer) => <article key={offer.packs} className={offer.packs === 2 ? styles.featuredPackage : ""}><span className={styles.packageLabel}>{offer.savingKobo ? `Save ₦${(offer.savingKobo / 100).toLocaleString("en-NG")}` : "Start your routine"}</span><h3>{offer.label} of Anagen</h3><p>{offer.packs * 2} sachets + application guide</p><strong>₦{(offer.totalKobo / 100).toLocaleString("en-NG")}</strong>{offer.packs === 1 && <s>₦15,000</s>}<small><Icon name="truck" /> Free doorstep delivery</small><AnagenBundleLink packs={offer.packs} className={styles.button}>Choose your package <Icon name="arrow" /></AnagenBundleLink></article>)}</div></section>

    <section className={`${styles.section} ${styles.container}`}><div className={styles.contents}><img src="/anagen/ari.jpg" alt="Anagen pack contents and application guide" width="800" height="800" loading="lazy" decoding="async" /><div><p className={styles.eyebrow}>Inside your pack</p><h2>Everything you need to get started.</h2><article><Icon name="box" /><div><h3>2 sachets of Anagen natural mix</h3><p>A concentrated herbal blend divided into two sachets in every pack.</p></div></article><article><Icon name="check" /><div><h3>A step-by-step procedure guide</h3><p>Printed instructions explaining how to mix and apply the formula with your hair cream or oil.</p></div></article></div></div></section>


    <section className={`${styles.section} ${styles.narrow}`}><div className={styles.deliveryNotice}><Icon name="truck" /><div><h2>A quick delivery note.</h2><p>We offer <strong>same-day delivery in state capitals</strong>, free doorstep delivery nationwide and payment on delivery. Please place an order when you are ready to receive and pay for it.</p><div><span><strong>Lagos:</strong> 1–2 working days</span><span><strong>Outside Lagos:</strong> 1–2 working days</span></div><small>Your selected availability helps our team arrange delivery. We will confirm the delivery time with you.</small></div></div></section>

    <section id="order-form" className={`${styles.section} ${styles.narrow} ${styles.orderSection}`}><AnagenOrderForm supportPhone={supportPhone} /></section>
    <footer className={styles.footer}><Link href="/shop" className={styles.footerBrand}>RENOVA</Link><p>Anagen herbal hair care, available at Renova.</p><nav aria-label="Footer"><Link href="/shop">Shop Renova</Link><Link href="/track-order">Track an order</Link><Link href="/privacy">Privacy</Link><Link href="/returns">Returns</Link><Link href="/terms">Terms</Link><a href="mailto:support@shoprenova.com.ng">Contact support</a></nav><small>© {new Date().getFullYear()} Renova. All rights reserved.</small></footer>
  </main>;
}
