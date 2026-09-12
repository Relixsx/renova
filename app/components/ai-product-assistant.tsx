"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AIProductAssistantResult,
  AIProductAssistantValues,
  AIProductListing,
} from "../lib/ai-product-listing";
import type { Category, Product } from "../lib/catalog";
import styles from "./ai-product-assistant.module.css";

const initialValues: AIProductAssistantValues = {
  roughName: "",
  supplierUrl: "",
  sellingPrice: "",
  costPrice: "",
  stock: "",
  notes: "",
  paymentMode: "prepaid",
  promoEnabled: false,
  promoLabel: "PROMO",
  compareAtPrice: "",
};

const progressMessages = [
  "Analysing all product images…",
  "Identifying visible product details…",
  "Checking useful product sources…",
  "Preparing the existing Renova fields…",
  "Validating uncertain information…",
];

type ApplyPayload = {
  listing: AIProductListing;
  images: File[];
  primaryImageIndex: number;
  values: AIProductAssistantValues;
};

function normalizedWords(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((word) => word.length > 2),
  );
}

function nameSimilarity(first: string, second: string) {
  const left = normalizedWords(first);
  const right = normalizedWords(second);
  if (!left.size || !right.size) return 0;
  const shared = Array.from(left).filter((word) => right.has(word)).length;
  return shared / Math.max(left.size, right.size);
}

function duplicateScore(listing: AIProductListing, product: Product) {
  const model = listing.model.trim().toLowerCase();
  const existingModel = (product.model ?? "").trim().toLowerCase();
  if (model && existingModel && model === existingModel) return 1;
  if (listing.name.trim().toLowerCase() === product.name.trim().toLowerCase())
    return 1;
  return nameSimilarity(listing.name, product.name);
}

async function analysisCopy(file: File) {
  const maximumEdge = 1_280;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      maximumEdge / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser could not prepare the image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("The image could not be prepared.")),
        "image/webp",
        0.82,
      ),
    );
    return new File(
      [blob],
      file.name.replace(/\.[^.]+$/, "") + "-analysis.webp",
      { type: "image/webp", lastModified: file.lastModified },
    );
  } catch (error) {
    if (
      ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
      file.size <= 6 * 1024 * 1024
    )
      return file;
    throw error;
  }
}

async function responsePayload(response: Response) {
  const text = await response.text();
  if (!text) return {} as AIProductAssistantResult & { error?: string };
  try {
    return JSON.parse(text) as AIProductAssistantResult & { error?: string };
  } catch {
    throw new Error(
      response.ok
        ? "The server returned an unreadable AI response."
        : "The AI listing service could not process this request.",
    );
  }
}

export function AIProductAssistant({
  categories,
  products,
  onApply,
}: {
  categories: Category[];
  products: Product[];
  onApply: (payload: ApplyPayload) => void | Promise<void>;
}) {
  const [values, setValues] = useState(initialValues);
  const [images, setImages] = useState<File[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  const [result, setResult] = useState<AIProductAssistantResult | null>(null);
  const [working, setWorking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const previews = useMemo(
    () => images.map((image) => URL.createObjectURL(image)),
    [images],
  );

  useEffect(
    () => () => previews.forEach((preview) => URL.revokeObjectURL(preview)),
    [previews],
  );

  const duplicates = useMemo(() => {
    if (!result) return [];
    return products
      .map((product) => ({
        product,
        score: duplicateScore(result.listing, product),
      }))
      .filter((match) => match.score >= 0.55)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);
  }, [products, result]);

  function updateValue<K extends keyof AIProductAssistantValues>(
    name: K,
    value: AIProductAssistantValues[K],
  ) {
    setValues((current) => ({ ...current, [name]: value }));
    if (name === "roughName" || name === "supplierUrl" || name === "notes") {
      setResult(null);
    }
  }

  function chooseImages(files: File[]) {
    setError("");
    setResult(null);
    const supported = files.filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    );
    if (supported.length !== files.length) {
      setError("AI analysis accepts JPG, PNG or WebP images only.");
    }
    if (supported.length > 3) {
      setError("Choose no more than three product images.");
    }
    const selected = supported.slice(0, 3);
    setImages(selected);
    setPrimaryImageIndex(0);
  }

  async function generateListing() {
    if (!values.roughName.trim()) {
      setError("Enter a rough product name first.");
      return;
    }
    if (!images.length) {
      setError("Choose at least one product image.");
      return;
    }
    const sellingPrice = Number(values.sellingPrice);
    const compareAtPrice = Number(values.compareAtPrice);
    if (
      values.promoEnabled &&
      values.sellingPrice &&
      values.compareAtPrice &&
      compareAtPrice <= sellingPrice
    ) {
      setError("The original promo price must be higher than the selling price.");
      return;
    }
    setWorking(true);
    setError("");
    setResult(null);
    setStatus(progressMessages[0]);
    let progressIndex = 0;
    const progressTimer = window.setInterval(() => {
      progressIndex = Math.min(progressIndex + 1, progressMessages.length - 1);
      setStatus(progressMessages[progressIndex]);
    }, 3_200);
    try {
      const preparedImages = await Promise.all(images.map(analysisCopy));
      const body = new FormData();
      body.set("roughName", values.roughName.trim());
      body.set("supplierUrl", values.supplierUrl.trim());
      body.set("notes", values.notes.trim());
      preparedImages.forEach((image) => body.append("images", image, image.name));
      const response = await fetch("/api/products/ai-assist", {
        method: "POST",
        body,
      });
      const payload = await responsePayload(response);
      if (!response.ok || !payload.listing) {
        throw new Error(payload.error || "The listing could not be generated.");
      }
      setResult(payload);
      setPrimaryImageIndex(
        Math.min(
          Math.max(payload.listing.primaryImageIndex || 0, 0),
          images.length - 1,
        ),
      );
      setStatus("Draft ready. Review the checks before opening the product form.");
    } catch (reason) {
      setStatus("");
      setError(
        reason instanceof Error
          ? reason.message
          : "The listing could not be generated.",
      );
    } finally {
      window.clearInterval(progressTimer);
      setWorking(false);
    }
  }

  async function applyListing() {
    if (!result) return;
    setApplying(true);
    setError("");
    try {
      await onApply({
        listing: result.listing,
        images,
        primaryImageIndex,
        values,
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The draft could not be opened in the product form.",
      );
    } finally {
      setApplying(false);
    }
  }

  function clearAssistant() {
    setValues(initialValues);
    setImages([]);
    setPrimaryImageIndex(0);
    setResult(null);
    setStatus("");
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  const selectedCategory = result
    ? categories.find(
        (category) => category.slug === result.listing.categorySlug,
      )
    : null;

  return (
    <section className={`admin-panel ${styles.panel}`} id="ai-product-assistant">
      <div className={`admin-panel-head ${styles.heading}`}>
        <div>
          <span className="eyebrow">Listing automation</span>
          <h2>AI Product Assistant</h2>
          <p>
            Add one to three images and a rough name. AI prepares the same
            product form you already use.
          </p>
        </div>
        <span className={styles.existingWorkflow}>Existing product system</span>
      </div>

      <div className={styles.body}>
        <form
          className={styles.inputPanel}
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void generateListing();
          }}
        >
          <div className={styles.stepHeading}>
            <span>1</span>
            <div>
              <b>Show the product</b>
              <small>Clear front, back and packaging views work best.</small>
            </div>
          </div>
          <label className={styles.imageDrop}>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                chooseImages(Array.from(event.target.files ?? []))
              }
            />
            <span>＋</span>
            <b>{images.length ? "Change product images" : "Choose 1–3 images"}</b>
            <small>
              JPG, PNG or WebP. Analysis copies are compressed before secure
              server-side AI processing.
            </small>
          </label>
          {images.length > 0 && (
            <div className={styles.imageGrid}>
              {images.map((image, index) => (
                <button
                  type="button"
                  className={
                    primaryImageIndex === index ? styles.selectedImage : ""
                  }
                  aria-pressed={primaryImageIndex === index}
                  onClick={() => setPrimaryImageIndex(index)}
                  key={`${image.name}-${image.lastModified}`}
                >
                  <img src={previews[index]} alt={`Product view ${index + 1}`} />
                  <span>
                    {primaryImageIndex === index
                      ? "Cover image"
                      : `View ${index + 1}`}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className={styles.stepHeading}>
            <span>2</span>
            <div>
              <b>Add the facts you know</b>
              <small>Prices you enter are preserved exactly.</small>
            </div>
          </div>
          <label className={styles.field}>
            <span>Rough product name *</span>
            <input
              required
              value={values.roughName}
              onChange={(event) => updateValue("roughName", event.target.value)}
              placeholder="Portable rechargeable mist fan"
              maxLength={180}
            />
          </label>
          <div className={styles.threeFields}>
            <label className={styles.field}>
              <span>Selling price (₦)</span>
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={values.sellingPrice}
                onChange={(event) =>
                  updateValue("sellingPrice", event.target.value)
                }
                placeholder="35000"
              />
            </label>
            <label className={styles.field}>
              <span>Cost price (₦)</span>
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={values.costPrice}
                onChange={(event) => updateValue("costPrice", event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className={styles.field}>
              <span>Stock available</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={values.stock}
                onChange={(event) => updateValue("stock", event.target.value)}
                placeholder="Confirm later"
              />
            </label>
          </div>
          <label className={styles.field}>
            <span>Supplier or product URL</span>
            <input
              type="url"
              value={values.supplierUrl}
              onChange={(event) => updateValue("supplierUrl", event.target.value)}
              placeholder="https://manufacturer-or-supplier.example/product"
            />
          </label>
          <label className={styles.field}>
            <span>Short notes</span>
            <textarea
              rows={4}
              value={values.notes}
              onChange={(event) => updateValue("notes", event.target.value)}
              placeholder="White version, rechargeable, USB cable included. Only write facts you know."
              maxLength={2_000}
            />
          </label>

          <div className={styles.stepHeading}>
            <span>3</span>
            <div>
              <b>Choose payment and promotion</b>
              <small>These are your decisions. AI will never choose them.</small>
            </div>
          </div>
          <div className={styles.ownerControls}>
            <fieldset className={styles.choiceGroup}>
              <legend>How should the customer pay?</legend>
              <div className={styles.choiceGrid}>
                <label
                  className={
                    values.paymentMode === "prepaid"
                      ? styles.selectedChoice
                      : undefined
                  }
                >
                  <input
                    type="radio"
                    name="ai-payment-mode"
                    value="prepaid"
                    checked={values.paymentMode === "prepaid"}
                    onChange={() => updateValue("paymentMode", "prepaid")}
                  />
                  <span>
                    <b>Pay before delivery</b>
                    <small>Customer pays securely through Paystack.</small>
                  </span>
                </label>
                <label
                  className={
                    values.paymentMode === "cash_on_delivery"
                      ? styles.selectedChoice
                      : undefined
                  }
                >
                  <input
                    type="radio"
                    name="ai-payment-mode"
                    value="cash_on_delivery"
                    checked={values.paymentMode === "cash_on_delivery"}
                    onChange={() =>
                      updateValue("paymentMode", "cash_on_delivery")
                    }
                  />
                  <span>
                    <b>Payment on delivery</b>
                    <small>Customer pays when the order is delivered.</small>
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset className={styles.choiceGroup}>
              <legend>Should this product carry a promo?</legend>
              <label className={styles.promoToggle}>
                <input
                  type="checkbox"
                  checked={values.promoEnabled}
                  onChange={(event) =>
                    updateValue("promoEnabled", event.target.checked)
                  }
                />
                <span>
                  <b>{values.promoEnabled ? "Promo enabled" : "No promo"}</b>
                  <small>
                    {values.promoEnabled
                      ? "Shows Renova's recurring two-hour promo banner until you switch it off."
                      : "The product will use the normal product-page presentation."}
                  </small>
                </span>
              </label>
              {values.promoEnabled && (
                <div className={styles.promoFields}>
                  <label className={styles.field}>
                    <span>Promo wording</span>
                    <input
                      value={values.promoLabel}
                      maxLength={28}
                      onChange={(event) =>
                        updateValue("promoLabel", event.target.value)
                      }
                      placeholder="PROMO"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Original / compare-at price (₦)</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={values.compareAtPrice}
                      onChange={(event) =>
                        updateValue("compareAtPrice", event.target.value)
                      }
                      placeholder="Optional"
                    />
                  </label>
                </div>
              )}
            </fieldset>
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {status && (
            <p className={working ? styles.working : styles.status} role="status">
              <i />
              {status}
            </p>
          )}
          <p className={styles.privacyNote}>
            Only the product images and details entered in this assistant are
            sent from the Renova backend to OpenAI. Prices, stock, payment and
            promo choices remain in the existing Renova form and are not used
            for AI analysis.
          </p>
          <div className={styles.formActions}>
            <button
              className="button quiet"
              type="button"
              onClick={clearAssistant}
              disabled={working || applying}
            >
              Clear
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={working || applying}
            >
              {working
                ? "Preparing listing…"
                : result
                  ? "Regenerate listing"
                  : "Generate listing"}
            </button>
          </div>
        </form>

        <aside className={styles.reviewPanel}>
          <div className={styles.stepHeading}>
            <span>4</span>
            <div>
              <b>Review before the normal form</b>
              <small>Nothing is saved or published automatically.</small>
            </div>
          </div>
          {!result ? (
            <div className={styles.emptyReview}>
              <span>✦</span>
              <h3>Your prepared listing will appear here.</h3>
              <p>
                The assistant uses existing Renova categories and flags facts
                that still need your confirmation.
              </p>
              <ul>
                <li>Images are analysed together once.</li>
                <li>Unknown specifications stay blank.</li>
                <li>The existing product form remains the final review.</li>
              </ul>
            </div>
          ) : (
            <div className={styles.result}>
              <span className={styles.ready}>Draft prepared</span>
              <h3>{result.listing.name}</h3>
              <p>{result.listing.shortDescription}</p>
              <div className={styles.resultMeta}>
                <span>{selectedCategory?.name ?? result.listing.categorySlug}</span>
                <span>{result.listing.brand || "Brand needs review"}</span>
                <span>{result.listing.variants.length} variant option(s)</span>
                <span>
                  {values.paymentMode === "cash_on_delivery"
                    ? "Payment on delivery"
                    : "Pay before delivery"}
                </span>
                <span>{values.promoEnabled ? values.promoLabel || "PROMO" : "No promo"}</span>
              </div>

              {duplicates.length > 0 && (
                <div className={styles.duplicateWarning} role="alert">
                  <b>Possible duplicate product</b>
                  <p>Check these existing listings before creating another:</p>
                  <ul>
                    {duplicates.map(({ product }) => (
                      <li key={product.slug}>
                        {product.name} <small>({product.sku})</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={styles.reviewChecks}>
                <div>
                  <b>Needs your review</b>
                  <span>{result.listing.reviewFlags.length}</span>
                </div>
                {result.listing.reviewFlags.length ? (
                  <ul>
                    {result.listing.reviewFlags.map((flag, index) => (
                      <li key={`${flag.field}-${index}`}>
                        <span>{flag.confidence}</span>
                        <p>
                          <b>{flag.field}</b>
                          {flag.reason}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No material uncertainty was reported. Still verify the draft.</p>
                )}
              </div>

              {result.sources.length > 0 && (
                <div className={styles.sources}>
                  <b>Sources found or supplied</b>
                  <ul>
                    {result.sources.map((source) => (
                      <li key={source.url}>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title} ↗
                        </a>
                        {source.kind === "supplied" && <small>Owner supplied</small>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className={styles.coverNote}>
                Cover selected: image {primaryImageIndex + 1}. Choose another
                thumbnail on the left if needed.
              </p>
              <button
                className={`button primary ${styles.applyButton}`}
                type="button"
                onClick={() => void applyListing()}
                disabled={working || applying}
              >
                {applying ? "Opening product form…" : "Review in product form"}
              </button>
              <small className={styles.modelNote}>
                Prepared with {result.model}. Prices, stock, payment, promo and
                publishing stay under your control.
              </small>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
