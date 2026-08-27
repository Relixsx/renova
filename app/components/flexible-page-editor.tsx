"use client";

import type {
  FlexibleProductPageConfig,
  LandingTextItem,
} from "../lib/catalog";

type Props = {
  value: FlexibleProductPageConfig;
  onChange: (value: FlexibleProductPageConfig) => void;
};
const lines = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
const pairs = (value: string): LandingTextItem[] =>
  lines(value)
    .map((item) => {
      const [title, ...text] = item.split("|");
      return { title: title.trim(), text: text.join("|").trim() };
    })
    .filter((item) => item.title);
const pairText = (items: LandingTextItem[]) =>
  items.map((item) => `${item.title} | ${item.text}`).join("\n");
const faqs = (value: string) =>
  pairs(value).map(({ title, text }) => ({ question: title, answer: text }));
const faqText = (items: Array<{ question: string; answer: string }>) =>
  items.map((item) => `${item.question} | ${item.answer}`).join("\n");

export function FlexiblePageEditor({ value, onChange }: Props) {
  const set = (
    section: keyof FlexibleProductPageConfig,
    changes: Record<string, unknown>,
  ) =>
    onChange({
      ...value,
      [section]: { ...value[section], ...changes },
    } as FlexibleProductPageConfig);
  const enabled = <K extends keyof FlexibleProductPageConfig>(section: K) =>
    "enabled" in value[section] ? (
      <label className="check-row">
        <input
          type="checkbox"
          checked={Boolean((value[section] as { enabled: boolean }).enabled)}
          onChange={(event) => set(section, { enabled: event.target.checked })}
        />
        <span>
          <b>Show this section</b>
          <small>Hide it without deleting what you entered.</small>
        </span>
      </label>
    ) : null;
  const field = (
    label: string,
    current: string,
    change: (next: string) => void,
    area = false,
    hint = "",
  ) => (
    <label>
      <span>{label}</span>
      {area ? (
        <textarea
          value={current}
          onChange={(event) => change(event.target.value)}
          placeholder={hint}
        />
      ) : (
        <input
          value={current}
          onChange={(event) => change(event.target.value)}
          placeholder={hint}
        />
      )}
    </label>
  );
  const heading = <
    K extends "gallery" | "reviews" | "features" | "process" | "faq",
  >(
    section: K,
  ) => (
    <>
      <div className="admin-grid-2">
        {field("Eyebrow", value[section].eyebrow, (eyebrow) =>
          set(section, { eyebrow }),
        )}
        {field("Heading", value[section].title, (title) =>
          set(section, { title }),
        )}
      </div>
      {field(
        "Supporting text",
        value[section].subtitle,
        (subtitle) => set(section, { subtitle }),
        true,
      )}
    </>
  );

  return (
    <div className="flexible-editor">
      <div className="flexible-editor-intro">
        <b>Flexible direct-response page</b>
        <p>
          Every panel below controls the dedicated{" "}
          <code>/offers/product-name</code> page. The normal Renova product
          template remains available.
        </p>
      </div>
      <details open>
        <summary>Theme & page navigation</summary>
        <div className="flexible-fields">
          <div className="theme-colour-grid">
            {(
              [
                "background",
                "surface",
                "text",
                "muted",
                "accent",
                "accentSecondary",
                "buttonText",
              ] as const
            ).map((key) => (
              <label key={key}>
                <span>{key.replace(/([A-Z])/g, " $1")}</span>
                <div>
                  <input
                    type="color"
                    value={value.theme[key]}
                    onChange={(event) =>
                      set("theme", { [key]: event.target.value })
                    }
                  />
                  <input
                    value={value.theme[key]}
                    onChange={(event) =>
                      set("theme", { [key]: event.target.value })
                    }
                  />
                </div>
              </label>
            ))}
          </div>
          <div className="admin-grid-2">
            {field("Brand label", value.navigation.brandLabel, (brandLabel) =>
              set("navigation", { brandLabel }),
            )}
            {field("Header CTA", value.navigation.ctaLabel, (ctaLabel) =>
              set("navigation", { ctaLabel }),
            )}
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={value.navigation.linksEnabled}
              onChange={(event) =>
                set("navigation", { linksEnabled: event.target.checked })
              }
            />
            <span>
              <b>Show navigation links</b>
              <small>Keep visitors able to browse the main store.</small>
            </span>
          </label>
        </div>
      </details>
      <details open>
        <summary>Offer bar, timer & trust ticker</summary>
        <div className="flexible-fields">
          {enabled("announcement")}
          <div className="admin-grid-2">
            {field("Offer wording", value.announcement.text, (text) =>
              set("announcement", { text }),
            )}
            {field(
              "Delivery wording",
              value.announcement.deliveryText,
              (deliveryText) => set("announcement", { deliveryText }),
            )}
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={value.announcement.countdownEnabled}
              onChange={(event) =>
                set("announcement", { countdownEnabled: event.target.checked })
              }
            />
            <span>
              <b>Show genuine countdown</b>
              <small>
                It uses one fixed deadline and never restarts after refresh.
              </small>
            </span>
          </label>
          {value.announcement.countdownEnabled && (
            <label>
              <span>Offer ends</span>
              <input
                type="datetime-local"
                value={value.announcement.endsAt}
                onChange={(event) =>
                  set("announcement", { endsAt: event.target.value })
                }
              />
            </label>
          )}
          {enabled("ticker")}
          {field(
            "Ticker items — one per line",
            value.ticker.items.join("\n"),
            (text) => set("ticker", { items: lines(text) }),
            true,
          )}
        </div>
      </details>
      <details open>
        <summary>Hero</summary>
        <div className="flexible-fields">
          <div className="admin-grid-2">
            {field("Eyebrow", value.hero.eyebrow, (eyebrow) =>
              set("hero", { eyebrow }),
            )}
            {field("Button label", value.hero.ctaLabel, (ctaLabel) =>
              set("hero", { ctaLabel }),
            )}
          </div>
          {field("Main headline", value.hero.headline, (headline) =>
            set("hero", { headline }),
          )}
          {field("Highlighted words", value.hero.highlight, (highlight) =>
            set("hero", { highlight }),
          )}
          {field(
            "Subtitle",
            value.hero.subtitle,
            (subtitle) => set("hero", { subtitle }),
            true,
          )}
          {field(
            "Optional hero image/video URL",
            value.hero.mediaUrl,
            (mediaUrl) => set("hero", { mediaUrl }),
          )}
        </div>
      </details>
      <details>
        <summary>Trust cards & metrics</summary>
        <div className="flexible-fields">
          {enabled("trust")}
          {field(
            "Trust cards — Title | Description",
            pairText(value.trust.items),
            (text) => set("trust", { items: pairs(text) }),
            true,
            "Free delivery | On eligible orders",
          )}
          {enabled("metrics")}
          {field(
            "Metrics — Value | Label",
            pairText(value.metrics.items),
            (text) => set("metrics", { items: pairs(text) }),
            true,
            "3–5 days | Estimated delivery",
          )}
        </div>
      </details>
      <details>
        <summary>Gallery & customer reviews</summary>
        <div className="flexible-fields">
          {enabled("gallery")}
          {heading("gallery")}
          {enabled("reviews")}
          {heading("reviews")}
          <p className="admin-help">
            Gallery media comes from the product image/video uploader. Reviews
            come only from the Review Manager.
          </p>
        </div>
      </details>
      <details>
        <summary>Problem & solution story</summary>
        <div className="flexible-fields">
          {enabled("problem")}
          <div className="admin-grid-2">
            {field("Eyebrow", value.problem.eyebrow, (eyebrow) =>
              set("problem", { eyebrow }),
            )}
            {field("Section heading", value.problem.title, (title) =>
              set("problem", { title }),
            )}
          </div>
          {field(
            "Pain points — one per line",
            value.problem.items.join("\n"),
            (text) => set("problem", { items: lines(text) }),
            true,
          )}
          {field(
            "Solution heading",
            value.problem.solutionTitle,
            (solutionTitle) => set("problem", { solutionTitle }),
          )}
          {field(
            "Solution copy",
            value.problem.solutionText,
            (solutionText) => set("problem", { solutionText }),
            true,
          )}
          {field(
            "Optional image/video URL",
            value.problem.mediaUrl,
            (mediaUrl) => set("problem", { mediaUrl }),
          )}
        </div>
      </details>
      <details>
        <summary>Features & how it works</summary>
        <div className="flexible-fields">
          {enabled("features")}
          {heading("features")}
          {field(
            "Features — Title | Description",
            pairText(value.features.items),
            (text) => set("features", { items: pairs(text) }),
            true,
          )}
          {enabled("process")}
          {heading("process")}
          {field(
            "Steps — Title | Description",
            pairText(value.process.items),
            (text) => set("process", { items: pairs(text) }),
            true,
          )}
        </div>
      </details>
      <details>
        <summary>Before & after comparison</summary>
        <div className="flexible-fields">
          {enabled("comparison")}
          <div className="admin-grid-2">
            {field("Eyebrow", value.comparison.eyebrow, (eyebrow) =>
              set("comparison", { eyebrow }),
            )}
            {field("Heading", value.comparison.title, (title) =>
              set("comparison", { title }),
            )}
          </div>
          <div className="admin-grid-2">
            {field(
              "Before title",
              value.comparison.beforeTitle,
              (beforeTitle) => set("comparison", { beforeTitle }),
            )}
            {field("After title", value.comparison.afterTitle, (afterTitle) =>
              set("comparison", { afterTitle }),
            )}
          </div>
          <div className="admin-grid-2">
            {field(
              "Before items",
              value.comparison.beforeItems.join("\n"),
              (text) => set("comparison", { beforeItems: lines(text) }),
              true,
            )}
            {field(
              "After items",
              value.comparison.afterItems.join("\n"),
              (text) => set("comparison", { afterItems: lines(text) }),
              true,
            )}
          </div>
        </div>
      </details>
      <details>
        <summary>Offer card & countdown</summary>
        <div className="flexible-fields">
          {enabled("offer")}
          <div className="admin-grid-2">
            {field("Eyebrow", value.offer.eyebrow, (eyebrow) =>
              set("offer", { eyebrow }),
            )}
            {field("Button label", value.offer.ctaLabel, (ctaLabel) =>
              set("offer", { ctaLabel }),
            )}
          </div>
          {field("Offer heading", value.offer.title, (title) =>
            set("offer", { title }),
          )}
          {field(
            "Offer description",
            value.offer.subtitle,
            (subtitle) => set("offer", { subtitle }),
            true,
          )}
          {field(
            "Availability wording",
            value.offer.stockMessage,
            (stockMessage) => set("offer", { stockMessage }),
          )}
          <label className="check-row">
            <input
              type="checkbox"
              checked={value.offer.countdownEnabled}
              onChange={(event) =>
                set("offer", { countdownEnabled: event.target.checked })
              }
            />
            <span>
              <b>Show offer countdown</b>
              <small>Uses the deadline below.</small>
            </span>
          </label>
          {value.offer.countdownEnabled && (
            <label>
              <span>Offer ends</span>
              <input
                type="datetime-local"
                value={value.offer.endsAt}
                onChange={(event) =>
                  set("offer", { endsAt: event.target.value })
                }
              />
            </label>
          )}
        </div>
      </details>
      <details>
        <summary>FAQ</summary>
        <div className="flexible-fields">
          {enabled("faq")}
          {heading("faq")}
          {field(
            "Questions — Question | Answer",
            faqText(value.faq.items),
            (text) => set("faq", { items: faqs(text) }),
            true,
          )}
        </div>
      </details>
      <details>
        <summary>Order section & closing CTA</summary>
        <div className="flexible-fields">
          {enabled("order")}
          <div className="admin-grid-2">
            {field("Order eyebrow", value.order.eyebrow, (eyebrow) =>
              set("order", { eyebrow }),
            )}
            {field("Order button", value.order.buttonLabel, (buttonLabel) =>
              set("order", { buttonLabel }),
            )}
          </div>
          {field("Order heading", value.order.title, (title) =>
            set("order", { title }),
          )}
          {field(
            "Order subtitle",
            value.order.subtitle,
            (subtitle) => set("order", { subtitle }),
            true,
          )}
          {enabled("finalCta")}
          {field("Closing headline", value.finalCta.title, (title) =>
            set("finalCta", { title }),
          )}
          {field(
            "Highlighted closing words",
            value.finalCta.highlight,
            (highlight) => set("finalCta", { highlight }),
          )}
          {field(
            "Closing text",
            value.finalCta.subtitle,
            (subtitle) => set("finalCta", { subtitle }),
            true,
          )}
          {field("Closing button", value.finalCta.buttonLabel, (buttonLabel) =>
            set("finalCta", { buttonLabel }),
          )}
          {enabled("stickyCta")}
          {field("Mobile sticky button", value.stickyCta.label, (label) =>
            set("stickyCta", { label }),
          )}
        </div>
      </details>
    </div>
  );
}
