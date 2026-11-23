/* eslint-disable @next/next/no-img-element -- Campaign photos have locally optimized responsive variants. */
import type { Metadata } from "next";
import Link from "next/link";
import { ANAGEN } from "../lib/anagen-offer.mjs";
import { absoluteUrl } from "../lib/site";
import { Anagen3BundleButton, Anagen3Checkout, Anagen3StickyOrder, Anagen3Stock } from "./interactive";
import styles from "./anagen3.module.css";

const title = "Anagen Hair Reviver · From ₦11,200";
const description = "Anagen is a concentrated herbal hair-care blend with two sachets and an application guide per pack. Free doorstep delivery and pay on delivery with Renova.";
const heroImage = "/anagen3/pack-860.webp";
const money = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/anagen3" },
  openGraph: { title, description, url: "/anagen3", type: "website", images: [{ url: absoluteUrl(heroImage), width: 860, height: 860, alt: "Anagen Hair Reviver silver pouch" }] },
  twitter: { card: "summary_large_image", title, description, images: [absoluteUrl(heroImage)] },
};

const icons = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  check: "m4 12 5 5L20 6",
  box: "m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4",
  truck: "M2 6h12v10H2zm12 4h4l4 4v2h-8M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  phone: "M4 3h4l2 5-3 2c1 3 4 6 7 7l2-3 5 2v4c-1 3-7 1-11-2s-7-8-7-12c0-2 1-3 1-3Z",
  wallet: "M3 6h17a2 2 0 0 1 2 2v11H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM22 10h-6a2 2 0 0 0 0 5h6M4 6l12-3 1 3",
};

type IconName = keyof typeof icons;

function Icon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg>;
}

function OrderLink({ primary = false }: { primary?: boolean }) {
  return <a href="#order-form" id={primary ? "anagen3-primary" : undefined} className={styles.button}>Place my order <Icon name="arrow" /></a>;
}

const concerns = [
  { image: "concern-edges", title: "Thinning-looking edges", alt: "Illustration of a woman checking the fine hairs at her temple" },
  { image: "concern-breakage", title: "Brittle strands", alt: "Illustration of a woman holding the ends of her coily hair" },
  { image: "concern-scalp", title: "Dry-feeling scalp", alt: "Illustration of a man parting his short coils to check his scalp" },
];

const steps: { icon: IconName; title: string; text: string }[] = [
  { icon: "box", title: "Choose your pack", text: "Pick one, two or three packs and fill in the form." },
  { icon: "phone", title: "Confirm your order", text: "Keep your phone nearby. Renova will contact you to confirm delivery." },
  { icon: "truck", title: "Get it delivered", text: "We’ll arrange free doorstep delivery to your address." },
  { icon: "wallet", title: "Pay when it arrives", text: "Pay the total shown on your order when you receive it." },
];

const customerPhotos = [1, 7, 2, 3, 4, 5, 6, 8, 9].map(number => ({
  src: `/anagen/customer-gallery/photo-${String(number).padStart(2, "0")}.webp`,
  width: 1080,
  height: 810,
  alt: `Before and after hair comparison ${number}, shared with Renova`,
}));

const [heroComparison, routineComparison] = customerPhotos;

const supplierPhotos = [
  { src: "/anagen/hair1.jpg", width: 246, height: 132, alt: "Before and after views of the top of the scalp, shared by Anagen’s supplier" },
  { src: "/anagen/hair2.jpg", width: 246, height: 144, alt: "Before and after photos of the crown, shared by Anagen’s supplier" },
  { src: "/anagen/hair3.jpg", width: 246, height: 141, alt: "Before and after photos of the side hairline, shared by Anagen’s supplier" },
];

function ComparisonPhoto({ src, width, height, alt }: { src: string; width: number; height: number; alt: string }) {
  return <figure className={styles.proofPhoto}>
    <a href={src} title="View full-size photo">
      <img src={src} width={width} height={height} alt={alt} loading="lazy" decoding="async" />
    </a>
  </figure>;
}

export default function Anagen3Page() {
  const supportPhone = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");
  const [starter] = ANAGEN.bundles;
  const support = supportPhone ? `https://wa.me/${supportPhone}` : "mailto:support@shoprenova.com.ng";
  const questions: [string, React.ReactNode][] = [
    ["What comes in each pack?", "Each 10 g pack has two sachets of Anagen natural mix and a printed application guide."],
    ["Can I use my own hair cream or oil?", "Yes. Follow the instructions in the pack to mix Anagen with your preferred hair cream or oil."],
    ["How much does delivery cost?", "Doorstep delivery is free on every bundle shown on this page."],
    ["When should I expect my order?", `Estimated delivery is ${ANAGEN.estimate}. Renova will confirm timing for your address.`],
    ["How do I track my order?", <>Keep the reference shown after you submit the form. Use it to <Link href="/track-order">track your order</Link> or contact <a href={support}>Renova support</a>.</>],
    ["What is the return policy?", <>See Renova’s <Link href="/returns">returns policy</Link> for eligibility and fees. Request an eligible return within seven calendar days of delivery.</>],
  ];
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: ANAGEN.name, sku: ANAGEN.sku, brand: { "@type": "Brand", name: "Anagen" }, description, image: absoluteUrl(heroImage), offers: { "@type": "Offer", url: absoluteUrl("/anagen3"), price: (starter.totalKobo / 100).toFixed(2), priceCurrency: "NGN" } };

  return <main className={styles.page}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <header className={styles.masthead}>
      <div className={styles.container}>
        <Link href="/anagen3" className={styles.brand} aria-label="Anagen by Renova">anagen<span aria-hidden="true">.</span><small>BY RENOVA</small></Link>
        <nav aria-label="Anagen">
          <a href="#customer-photos" className={styles.navLink}>Customer photos</a>
          <a href="#packages" className={styles.navLink}>Packages</a>
          <a href="#order-form" className={styles.headerOrder}>Order now <Icon name="arrow" /></a>
        </nav>
      </div>
    </header>

    <Anagen3Stock>
      <section className={styles.hero} aria-labelledby="anagen3-heading">
        <div className={styles.container}>
          <header className={styles.heroHeading}>
            <h1 id="anagen3-heading">Anagen <span>Hair Reviver</span></h1>
            <p>A concentrated herbal blend for thinning-looking edges, brittle strands and your everyday scalp care.</p>
          </header>
          <div className={styles.heroGrid}>
            <figure className={styles.heroPhoto}>
              <div className={styles.packPhoto}>
                <img src={heroImage} srcSet="/anagen3/pack-540.webp 540w, /anagen3/pack-860.webp 860w" sizes="(max-width: 720px) clamp(198px, 62vw, 320px), clamp(285px, 40.5vw, 470px)" width="860" height="860" fetchPriority="high" alt="Actual Anagen Hair Reviver pouch in silver packaging" />
              </div>
              <a className={styles.heroComparison} href={heroComparison.src} title="View full-size photo">
                <img src={heroComparison.src} width={heroComparison.width} height={heroComparison.height} alt="Before and after hair photos of a man, shared with Renova" />
              </a>
            </figure>

            <ul className={styles.heroBenefits}>
              <li><Icon name="check" /><span><strong>Herbal scalp care.</strong> Bring fenugreek, amla, moringa and rosemary into your routine.</span></li>
              <li><Icon name="check" /><span><strong>Mix with your usual cream or oil.</strong> Follow the instructions in the pack.</span></li>
              <li><Icon name="check" /><span><strong>2 sachets and a guide.</strong> Included in each 10 g pack.</span></li>
            </ul>

            <div className={styles.heroAction}>
              <div className={styles.heroOffer}><span>Starting from</span><strong>{money(starter.totalKobo)}</strong></div>
              <OrderLink primary />
              <div className={styles.heroTrust}>
                <span><Icon name="wallet" /> Pay on delivery</span>
                <span><Icon name="truck" /> Free doorstep delivery</span>
              </div>
              <a className={styles.heroProofLink} href="#customer-photos">See all {customerPhotos.length + supplierPhotos.length} comparisons <Icon name="arrow" /></a>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.concerns} aria-labelledby="concern-heading">
        <div className={`${styles.container} ${styles.section}`}>
          <header className={styles.sectionHeading}>
            <h2 id="concern-heading">Which part of your hair needs <em>more attention?</em></h2>
          </header>
          <div className={styles.concernGrid}>
            {concerns.map(({ image, title: heading, alt }) =>
              <figure className={styles.concernCard} key={image}>
                <img src={`/anagen3/${image}.webp`} width="540" height="455" loading="lazy" decoding="async" alt={alt} />
                <figcaption>{heading}</figcaption>
              </figure>
            )}
          </div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.section} ${styles.routine}`} aria-labelledby="use-heading">
        <ComparisonPhoto {...routineComparison} alt="Before and after hair photos of a man with a beard, shared with Renova" />
        <div className={styles.routineCopy}>
          <h2 id="use-heading">Keep the hair routine you know. <em>Add Anagen.</em></h2>
          <p>Anagen is a dry herbal blend you mix into the cream or oil you already use. The printed guide walks you through preparing the mix and applying it.</p>
          <ul className={styles.mixingList}>
            <li><strong>01</strong><span>Choose your usual hair cream or oil.</span></li>
            <li><strong>02</strong><span>Mix Anagen into it as directed in the guide.</span></li>
            <li><strong>03</strong><span>Follow the application instructions in your pack.</span></li>
          </ul>
          <OrderLink />
        </div>
      </section>

      <section id="customer-photos" className={styles.proof} aria-labelledby="proof-heading">
        <div className={`${styles.container} ${styles.section}`}>
          <header className={styles.sectionHeading}>
            <h2 id="proof-heading">Before &amp; after photos</h2>
            <p>Photos shared by Anagen customers. Select a photo to see it full size. Individual experiences vary.</p>
          </header>
          <div className={styles.proofGrid} role="region" aria-label="Customer before and after photos">
            {customerPhotos.map(photo => <ComparisonPhoto key={photo.src} {...photo} />)}
          </div>
          <div className={styles.supplierProof} role="region" aria-labelledby="supplier-proof-heading">
            <h3 id="supplier-proof-heading">Photos shared by Anagen’s supplier</h3>
            <div className={styles.proofGrid}>
              {supplierPhotos.map(photo => <ComparisonPhoto key={photo.src} {...photo} />)}
            </div>
          </div>
          <div className={styles.centerAction}><OrderLink /></div>
        </div>
      </section>

      <section className={styles.included} aria-labelledby="inside-heading">
        <div className={`${styles.container} ${styles.section}`}>
          <header className={styles.sectionHeading}><h2 id="inside-heading">What comes in your pack</h2></header>
          <div className={styles.includedStack}>
            <article className={styles.includedCard}>
              <div className={styles.includedMedia}>
                <img src="/anagen3/pouch.webp" width="356" height="524" loading="lazy" decoding="async" alt="Anagen pouch with its herbal sachets visible" />
                <img src="/anagen3/sachets.webp" width="224" height="220" loading="lazy" decoding="async" alt="Two Anagen sachets side by side" />
              </div>
              <div className={styles.includedCopy}>
                <h3>Two sealed sachets</h3>
                <p>Each pack contains 10 g of Anagen’s herbal powder, divided into two sachets. Mix it into your preferred hair cream or oil using the supplied directions.</p>
              </div>
            </article>
            <article className={`${styles.includedCard} ${styles.guideCard}`}>
              <div className={styles.blendMedia}>
                <img src="/anagen3/blend.webp" width="650" height="504" loading="lazy" decoding="async" alt="Anagen’s dry herbal powder in a glass bowl" />
              </div>
              <div className={styles.includedCopy}>
                <h3>Printed application guide</h3>
                <p>The guide comes in the pack. Keep it nearby when preparing your first mix so you can follow the directions from mixing to application.</p>
              </div>
            </article>
          </div>
          <div className={styles.centerAction}><OrderLink /></div>
        </div>
      </section>

      <section id="packages" className={styles.packages} aria-labelledby="package-heading">
        <div className={`${styles.container} ${styles.section}`}>
          <header className={styles.sectionHeading}>
            <h2 id="package-heading">Choose your Anagen package</h2>
            <p>Free delivery. Pay the displayed total when your order arrives.</p>
          </header>
          <div className={styles.packageGrid}>
            {ANAGEN.bundles.map((bundle, index) => {
              const recommended = bundle.packs === 2;
              return <article key={bundle.packs} className={`${styles.packageCard} ${recommended ? styles.recommended : ""}`}>
                <p className={styles.packageTag}>{["Starter", "Recommended", "Best value"][index]}</p>
                <div className={styles.packVisual} aria-hidden="true">
                  {Array.from({ length: bundle.packs }, (_, packIndex) =>
                    <img key={packIndex} src="/anagen3/pack-540.webp" width="540" height="540" loading="lazy" decoding="async" alt="" />
                  )}
                </div>
                <h3>{bundle.label} of Anagen</h3>
                <p className={styles.packagePrice}>{money(bundle.totalKobo)}</p>
                <p className={styles.packContents}>{bundle.packs * 2} sachets + {bundle.packs === 1 ? "application guide" : "application guides"}</p>
                {bundle.savingKobo > 0 && <p className={styles.savings}>{`Save ${money(bundle.savingKobo)} vs. buying single packs`}</p>}
                <Anagen3BundleButton bundle={bundle} primary={recommended} />
              </article>;
            })}
          </div>
        </div>
      </section>

      <section className={styles.orderSteps} aria-labelledby="order-steps">
        <div className={`${styles.container} ${styles.section}`}>
          <header className={styles.sectionHeading}><h2 id="order-steps">How your order reaches you</h2></header>
          <ol className={styles.steps}>{steps.map(({ icon, title: heading, text }) =>
            <li key={heading}><Icon name={icon} /><h3>{heading}</h3><p>{text}</p></li>
          )}</ol>
        </div>
      </section>

      <section id="order-form" className={styles.checkout} aria-label="Anagen order form">
        <div className={`${styles.container} ${styles.section} ${styles.checkoutGrid}`}>
          <aside className={styles.checkoutInfo}>
            <h2>Ready to order?</h2>
            <p>Enter your delivery details and keep your phone nearby so we can confirm your order.</p>
            <ul>
              <li><Icon name="wallet" /> Pay when you receive it</li>
              <li><Icon name="truck" /> Free doorstep delivery</li>
              <li><Icon name="check" /> Estimated {ANAGEN.estimate}</li>
            </ul>
          </aside>
          <div className={styles.formFrame}><Anagen3Checkout supportPhone={supportPhone} /></div>
        </div>
      </section>
      <Anagen3StickyOrder />
    </Anagen3Stock>

    <section id="faq" className={styles.faq} aria-labelledby="faq-heading">
      <div className={`${styles.container} ${styles.section} ${styles.faqGrid}`}>
        <h2 id="faq-heading">Questions about Anagen?</h2>
        <div className={styles.questions}>{questions.map(([question, answer]) =>
          <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>
        )}</div>
      </div>
    </section>

    <footer className={styles.footer}><div className={styles.container}>
      <Link href="/shop" className={styles.brand}>anagen<span aria-hidden="true">.</span><small>BY RENOVA</small></Link>
      <nav aria-label="Footer">
        <Link href="/track-order">Track order</Link><Link href="/delivery">Delivery</Link><Link href="/returns">Returns</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href={support}>Contact Renova</a>
      </nav>
    </div></footer>
  </main>;
}
