import type { Metadata } from "next";
import Link from "next/link";
import { ANAGEN } from "../lib/anagen-offer.mjs";
import { absoluteUrl } from "../lib/site";
import { Anagen3BundleButton, Anagen3Checkout, Anagen3StickyOrder, Anagen3Stock } from "./interactive";
import styles from "./anagen3.module.css";

const title = "Anagen Hair Reviver · From ₦11,200";
const description = "A concentrated herbal blend for your hair-care routine. Two sachets and an application guide per pack. Free doorstep delivery and pay on delivery with Renova.";
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
  arrow: "M6 18 18 6M6 6h12v12",
  down: "M12 5v14m-6-6 6 6 6-6",
  check: "m4 12 5 5L20 6",
  leaf: "M20 4C11 2 3 7 5 14c1 5 8 7 12 2 3-4 3-9 3-12ZM4 21l11-11",
  box: "m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4",
  truck: "M2 5h12v12H2zM14 9h4l4 4v4h-8M5 17a2 2 0 1 0 4 0M16 17a2 2 0 1 0 4 0",
  drop: "M12 3c-2 4-7 8-7 12a7 7 0 0 0 14 0c0-4-5-8-7-12ZM8 16a4 4 0 0 0 3 3",
  book: "M12 6c-3-3-7-3-10-2v14c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v14",
  pin: "M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  phone: "M4 3h4l2 5-3 2c1 3 4 6 7 7l2-3 5 2v4c-1 3-7 1-11-2s-7-8-7-12c0-2 1-3 1-3Z",
  wallet: "M3 6h17a2 2 0 0 1 2 2v11H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM22 10h-6a2 2 0 0 0 0 5h6M4 6l12-3 1 3",
};
type IconName = keyof typeof icons;
function Icon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg>;
}

const concerns = [
  ["Thinning-looking edges", "Give delicate areas a regular place in your hair-care routine."],
  ["Weak, brittle strands", "Build a consistent routine for hair that feels dry or breaks easily."],
  ["Hard-to-manage hair", "Keep the scalp and hair products you already feel comfortable using."],
];

const benefits: { icon: IconName; title: string; text: string }[] = [
  { icon: "leaf", title: "A concentrated herbal blend", text: "A dry blend made with familiar botanicals including fenugreek, amla, moringa and rosemary." },
  { icon: "drop", title: "Mix with a product you know", text: "Use your preferred hair cream or oil and follow the printed mixing instructions." },
  { icon: "box", title: "Two sachets in each pack", text: "Each 10 g pack contains two sachets of Anagen natural mix." },
  { icon: "book", title: "Guidance from the first use", text: "The pack comes with a step-by-step guide to mixing and applying the blend." },
];

const steps: { icon: IconName; title: string; text: string }[] = [
  { icon: "box", title: "Choose your pack", text: "Select one, two or three packs." },
  { icon: "pin", title: "Enter your details", text: "Use a working phone number and include a landmark in your address." },
  { icon: "phone", title: "We’ll confirm with you", text: "Keep your phone available so Renova can confirm delivery." },
  { icon: "wallet", title: "Receive and pay", text: "Pay the displayed total when your order arrives." },
];

export default function Anagen3Page() {
  const supportPhone = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");
  const [starter] = ANAGEN.bundles;
  const support = supportPhone ? `https://wa.me/${supportPhone}` : "mailto:support@shoprenova.com.ng";
  const questions: [string, React.ReactNode][] = [
    ["What comes in each pack?", "Each 10 g pack has two sachets of Anagen natural mix and a printed application guide."],
    ["How do I apply Anagen?", "Follow the mixing and application directions in the guide supplied in your pack."],
    ["Can I use my existing hair cream or oil?", "Yes. The blend is made to be mixed with a hair cream or oil you already use."],
    ["Will it fit my hair-care routine?", "You can add it to your existing hair or scalp-care routine by following the supplied guide. Individual experiences vary."],
    ["How much is delivery?", "Doorstep delivery is free with all three Anagen bundles on this page."],
    ["When should I expect my order?", `The estimated delivery time is ${ANAGEN.estimate}. Renova will confirm timing for your address.`],
    ["Do I pay when it arrives?", "Yes. The exact package total is shown before you place your order and is payable on delivery."],
    ["What happens after I order?", <>Save the order reference on your confirmation screen. Renova will contact you to confirm delivery. You can also <Link href="/track-order">track your order</Link>.</>],
    ["How can I contact Renova?", <>Contact <a href={support}>{supportPhone ? "Renova on WhatsApp" : "Renova support by email"}</a> for help with your product or order.</>],
    ["What is the return policy?", <>Renova’s <Link href="/returns">returns policy</Link> explains eligibility and fees. Request an eligible return within seven calendar days of delivery and keep the item unused and in its original condition.</>],
  ];
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: ANAGEN.name, sku: ANAGEN.sku, brand: { "@type": "Brand", name: "Anagen" }, description, image: absoluteUrl(heroImage), offers: { "@type": "Offer", url: absoluteUrl("/anagen3"), price: (starter.totalKobo / 100).toFixed(2), priceCurrency: "NGN" } };

  return <main className={styles.page}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <header className={styles.masthead}>
      <div className={styles.container}>
        <Link href="/anagen3" className={styles.brand} aria-label="Anagen by Renova">
          anagen<span aria-hidden="true">.</span><small>BY RENOVA</small>
        </Link>
        <nav aria-label="Anagen">
          <a href="#packages" className={styles.navLink}>Packages</a>
          <a href="#faq" className={styles.navLink}>FAQ</a>
          <a href="#order-form" className={styles.headerOrder}>Order now <Icon name="arrow" /></a>
        </nav>
      </div>
    </header>
    <Anagen3Stock>
      <section className={styles.hero} aria-labelledby="anagen3-heading">
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Anagen Hair Reviver</p>
            <h1 id="anagen3-heading">Give your edges <em>a fresh start.</em></h1>
            <p>Thinning-looking edges or easy breakage? Make Anagen&rsquo;s concentrated herbal blend part of the hair and scalp routine you already use.</p>
          </div>
          <figure className={styles.heroPhoto}>
            {/* Pre-sized local variants keep the primary product image fetch independent of image transformation. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} srcSet="/anagen3/pack-540.webp 540w, /anagen3/pack-860.webp 860w" sizes="(max-width: 650px) 46vw, (max-width: 900px) 42vw, 450px" width="860" height="860" fetchPriority="high" alt="Actual Anagen Hair Reviver pouch in silver packaging" />
          </figure>
          <div className={styles.heroOffer}>
            <p className={styles.from}>Starting from</p>
            <p className={styles.heroPrice}>{money(starter.totalKobo)}</p>
            <p className={styles.heroPack}>2 sachets + guide per pack</p>
          </div>
          <div className={styles.heroAction}>
            <a href="#order-form" id="anagen3-primary" className={styles.button} aria-label="Order Anagen now — pay on delivery">Order Anagen now <Icon name="arrow" /></a>
            <div className={styles.heroTrust}>
              <span><Icon name="wallet" /> Pay on delivery</span>
              <span><Icon name="truck" /> Free doorstep delivery</span>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.section} ${styles.concerns}`} aria-labelledby="concerns">
        <figure className={styles.routinePhoto}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/anagen3/routine-900.webp" srcSet="/anagen3/routine-540.webp 540w, /anagen3/routine-900.webp 900w" sizes="(max-width: 720px) calc(100vw - 40px), 520px" width="900" height="675" loading="lazy" decoding="async" alt="Illustration of a woman tending to her natural curls in a mirror" />
          <figcaption>Illustrative lifestyle image</figcaption>
        </figure>
        <div>
          <p className={styles.kicker}>Your hair-care routine</p>
          <h2 id="concerns">A little extra care for the areas you notice first.</h2>
          <ul className={styles.concernList}>{concerns.map(([heading, text]) =>
            <li key={heading}><Icon name="check" /><div><h3>{heading}</h3><p>{text}</p></div></li>
          )}</ul>
        </div>
      </section>

      <section className={styles.benefits} aria-labelledby="benefits">
        <div className={`${styles.container} ${styles.section}`}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>The Anagen blend</p>
            <h2 id="benefits">Herbal care that fits your routine.</h2>
          </div>
          <div className={styles.benefitGrid}>
            {benefits.map(({icon, title: heading, text}) => <article key={heading}><span className={styles.iconTile}><Icon name={icon} /></span><h3>{heading}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.section}`} aria-labelledby="inside">
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Product details</p>
          <h2 id="inside">Take a look inside the pack.</h2>
        </div>
        <div className={styles.productGrid}>
          {[
            { image: "pouch", alt: "Anagen retail pouch with the herbal sachets visible", width: 356, height: 524, label: "Anagen Hair Reviver", text: "The 10 g retail pack." },
            { image: "sachets", alt: "Two Anagen sachets laid side by side", width: 224, height: 220, label: "Two sealed sachets", text: "The printed application guide is included." },
            { image: "blend", alt: "The dry Anagen herbal powder in a glass bowl", width: 650, height: 504, label: "The dry herbal blend", text: "Mix with cream or oil as directed in the guide." },
          ].map(({ image, alt, width, height, label, text }) => <figure key={image} className={styles.productTile}>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/anagen3/${image}.webp`} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
            </div>
            <figcaption><h3>{label}</h3><p>{text}</p></figcaption>
          </figure>)}
        </div>
        <aside className={styles.useNote}><Icon name="book" /><p><strong>How to get started.</strong> Choose your usual hair cream or oil, then follow the mixing and application directions that come with your pack.</p></aside>
      </section>

      <section id="packages" className={styles.packages} aria-labelledby="package-heading">
        <div className={`${styles.container} ${styles.section}`}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Pay on delivery</p>
            <h2 id="package-heading">Choose your Anagen package.</h2>
            <p>Free doorstep delivery on every package.</p>
          </div>
          <div className={styles.packageGrid}>{ANAGEN.bundles.map((bundle, index) => {
            const recommended = bundle.packs === 2;
            return <article key={bundle.packs} className={`${styles.packageCard} ${recommended ? styles.recommended : ""}`}>
              <p className={styles.packageTag}>{["Starter", "Recommended", "Best value"][index]}</p>
              <h3>{bundle.label} of Anagen</h3>
              <p className={styles.packagePrice}>{money(bundle.totalKobo)}</p>
              <p className={styles.packContents}>{bundle.packs * 2} sachets + {bundle.packs === 1 ? "application guide" : "application guides"}</p>
              {bundle.savingKobo > 0 && <p className={styles.savings}>{`Save ${money(bundle.savingKobo)} vs. buying single packs`}</p>}
              <Anagen3BundleButton bundle={bundle} primary={recommended} />
            </article>;
          })}</div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.section}`} aria-labelledby="order-steps">
        <div className={styles.sectionHeading}><h2 id="order-steps">How ordering works.</h2></div>
        <ol className={styles.steps}>{steps.map(({icon, title: heading, text}, index) =>
          <li key={heading}><div><Icon name={icon}/><span>{index + 1}</span></div><h3>{heading}</h3><p>{text}</p></li>
        )}</ol>
      </section>

      <section id="faq" className={styles.faq} aria-labelledby="faq-heading">
        <div className={`${styles.container} ${styles.section} ${styles.faqGrid}`}>
          <div>
            <h2 id="faq-heading">Good to know.</h2>
            <p>Questions about Anagen, payment or delivery.</p>
          </div>
          <div className={styles.questions}>{questions.map(([question, answer]) =>
            <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>
          )}</div>
        </div>
      </section>

      <section id="order-form" className={styles.checkout} aria-label="Anagen order form">
        <div className={`${styles.container} ${styles.section} ${styles.checkoutGrid}`}>
          <aside className={styles.checkoutInfo}>
            <p className={styles.kicker}>Order Anagen</p>
            <h2>Delivered to your door.</h2>
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

    <footer className={styles.footer}><div className={styles.container}>
      <Link href="/shop" className={styles.brand}>anagen<span aria-hidden="true">.</span><small>BY RENOVA</small></Link>
      <nav aria-label="Footer">
        <Link href="/track-order">Track order</Link><Link href="/delivery">Delivery</Link><Link href="/returns">Returns</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href={support}>Contact Renova</a>
      </nav>
    </div></footer>
  </main>;
}
