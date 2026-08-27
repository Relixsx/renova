"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  categoryName,
  defaultFlexibleProductPage,
  formatNaira,
  normalizeFlexibleProductPage,
  productHref,
  type Category,
  type FlexibleProductPageConfig,
  type Product,
  type Review,
} from "../lib/catalog";
import { FlexiblePageEditor } from "./flexible-page-editor";

type AdminOrder = {
  id: number;
  orderNumber: string;
  customerName: string;
  paymentStatus: string;
  paymentMethod?: string;
  status: string;
  totalKobo: number;
  createdAt: string;
};
const emptyForm = {
  name: "",
  categorySlug: "phones-tablets",
  pageTemplate: "standard",
  sku: "",
  shortDescription: "",
  description: "",
  priceNaira: "",
  compareAtNaira: "",
  supplierCostNaira: "",
  stock: "10",
  soldCount: "0",
  paymentMode: "prepaid",
  variants: "Standard",
  badge: "",
  supplierName: "",
  supplierUrl: "",
  imageUrl: "",
  brand: "",
  model: "",
  materials: "",
  dimensions: "",
  weight: "",
  colour: "",
  size: "",
  warranty: "",
  packageContents: "",
  countryOfOrigin: "",
  careInstructions: "",
  compatibility: "",
  specifications: "",
  chatbotKnowledge: "",
  chatbotFaq: "",
  promoEnabled: false,
  promoLabel: "PROMO",
  promoEndsAt: "",
  isFeatured: false,
  isPublished: true,
};
const emptyReview = {
  productSlug: "",
  reviewerName: "",
  rating: "5",
  title: "",
  body: "",
  isVerifiedPurchase: false,
  reviewedAt: "",
};

function parseList(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  try {
    return JSON.parse(String(value ?? "[]")) as string[];
  } catch {
    return [];
  }
}
function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
async function responsePayload<T extends Record<string, unknown>>(
  response: Response,
): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    if (response.status === 413 || /payload too large/i.test(text)) {
      throw new Error(
        "This file is too large for the upload service. Use an image under 15 MB or a video under 50 MB.",
      );
    }
    throw new Error(
      response.ok
        ? "The server returned an unreadable response."
        : text.slice(0, 240),
    );
  }
}
async function optimizeProductImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const maximumEdge = 1800;
  const scale = Math.min(
    1,
    maximumEdge / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser could not optimize the image.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = "brightness(1.035) contrast(1.025) saturate(1.015)";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("Image optimization failed.")),
      "image/webp",
      0.88,
    ),
  );
  return new File(
    [blob],
    file.name.replace(/\.[^.]+$/, "") + "-optimized.webp",
    { type: "image/webp", lastModified: Date.now() },
  );
}
function rawProduct(raw: Record<string, unknown>): Product {
  let specifications = {};
  try {
    specifications = JSON.parse(String(raw.specificationsJson ?? "{}"));
  } catch {}
  let chatbotFaq = [];
  try {
    chatbotFaq = JSON.parse(String(raw.chatbotFaqJson ?? "[]"));
  } catch {}
  let landingPage = {};
  try {
    landingPage = JSON.parse(String(raw.landingPageJson ?? "{}"));
  } catch {}
  const product: Product = {
    id: Number(raw.id),
    name: String(raw.name),
    slug: String(raw.slug),
    sku: String(raw.sku),
    categorySlug: String(raw.categorySlug),
    shortDescription: String(raw.shortDescription ?? ""),
    description: String(raw.description ?? ""),
    priceKobo: Number(raw.priceKobo),
    compareAtKobo: raw.compareAtKobo ? Number(raw.compareAtKobo) : null,
    supplierCostKobo: raw.supplierCostKobo
      ? Number(raw.supplierCostKobo)
      : null,
    imageUrl: String(raw.imageUrl),
    gallery: parseList(raw.gallery ?? raw.galleryJson),
    stock: Number(raw.stock),
    soldCount: Number(raw.soldCount ?? 0),
    paymentMode:
      raw.paymentMode === "cash_on_delivery" ? "cash_on_delivery" : "prepaid",
    badge: raw.badge ? String(raw.badge) : null,
    rating: Number(raw.rating ?? 0),
    reviewCount: Number(raw.reviewCount ?? 0),
    isFeatured: Boolean(raw.isFeatured),
    isPublished: Boolean(raw.isPublished),
    isTestData: Boolean(raw.isTestData),
    variants: parseList(raw.variants ?? raw.variantsJson),
    specifications,
    chatbotFaq,
    brand: String(raw.brand ?? ""),
    model: String(raw.model ?? ""),
    materials: String(raw.materials ?? ""),
    dimensions: String(raw.dimensions ?? ""),
    weight: String(raw.weight ?? ""),
    colour: String(raw.colour ?? ""),
    size: String(raw.size ?? ""),
    warranty: String(raw.warranty ?? ""),
    packageContents: String(raw.packageContents ?? ""),
    countryOfOrigin: String(raw.countryOfOrigin ?? ""),
    careInstructions: String(raw.careInstructions ?? ""),
    compatibility: String(raw.compatibility ?? ""),
    chatbotKnowledge: String(raw.chatbotKnowledge ?? ""),
    pageTemplate: raw.pageTemplate === "flexible" ? "flexible" : "standard",
    promoEnabled: Boolean(raw.promoEnabled),
    promoLabel: String(raw.promoLabel ?? "PROMO"),
    promoEndsAt: String(raw.promoEndsAt ?? ""),
  };
  product.landingPage = normalizeFlexibleProductPage(product, landingPage);
  return product;
}

export function AdminCatalogue({
  initialProducts,
  initialReviews,
  initialOrders,
  categories,
  ownerName,
}: {
  initialProducts: Product[];
  initialReviews: Review[];
  initialOrders: AdminOrder[];
  categories: Category[];
  ownerName: string;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [reviews, setReviews] = useState(initialReviews);
  const [orderRows, setOrderRows] = useState(initialOrders);
  const [form, setForm] = useState(emptyForm);
  const [landingPage, setLandingPage] = useState<FlexibleProductPageConfig>(
    () => defaultFlexibleProductPage(),
  );
  const [reviewForm, setReviewForm] = useState({
    ...emptyReview,
    productSlug: initialProducts[0]?.slug ?? "",
  });
  const [reviewCategory, setReviewCategory] = useState(
    initialProducts[0]?.categorySlug ?? categories[0]?.slug ?? "",
  );
  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  const [localPreview, setLocalPreview] = useState("");
  const [originalCoverPreview, setOriginalCoverPreview] = useState("");
  const [enhancedCoverUrl, setEnhancedCoverUrl] = useState("");
  const [enhancedGalleryUrls, setEnhancedGalleryUrls] = useState<
    Record<string, string>
  >({});
  const [aiStudioEnabled, setAiStudioEnabled] = useState(true);
  const [enhancementMode, setEnhancementMode] = useState("studio");
  const [studioStatus, setStudioStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [catalogueMessage, setCatalogueMessage] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  async function updateOrderStatus(order: AdminOrder, status: string) {
    setOrderMessage(`Updating ${order.orderNumber}…`);
    try {
      const response = await fetch("/api/orders/admin", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderNumber: order.orderNumber, status }),
      });
      const payload = await responsePayload<{
        order?: AdminOrder;
        error?: string;
      }>(response);
      if (!response.ok || !payload.order)
        throw new Error(payload.error || "The order could not be updated.");
      setOrderRows((current) =>
        current.map((item) =>
          item.id === payload.order!.id ? payload.order! : item,
        ),
      );
      setOrderMessage(`${order.orderNumber} is now ${status}.`);
    } catch (error) {
      setOrderMessage(
        error instanceof Error
          ? error.message
          : "The order could not be updated.",
      );
    }
  }

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const needle = search.trim().toLowerCase();
        return (
          (filter === "all" || product.categorySlug === filter) &&
          (!needle ||
            product.name.toLowerCase().includes(needle) ||
            product.sku.toLowerCase().includes(needle))
        );
      }),
    [products, filter, search],
  );
  const reviewProducts = useMemo(
    () => products.filter((product) => product.categorySlug === reviewCategory),
    [products, reviewCategory],
  );
  const revenueEstimate = products.reduce(
    (sum, product) => sum + product.priceKobo * Math.min(product.stock, 2),
    0,
  );
  function updateField(name: keyof typeof emptyForm, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }
  function resetStudio() {
    setOriginalCoverPreview("");
    setEnhancedCoverUrl("");
    setEnhancedGalleryUrls({});
    setStudioStatus("");
  }
  function openNew(categorySlug = "phones-tablets") {
    setEditingId(null);
    setForm({ ...emptyForm, categorySlug });
    setLandingPage(defaultFlexibleProductPage({ categorySlug } as Product));
    setPrimaryFile(null);
    setGalleryFiles([]);
    setExistingGallery([]);
    setLocalPreview("");
    resetStudio();
    setMessage("");
    setProductModalOpen(true);
  }
  function openEdit(product: Product) {
    setEditingId(product.id ?? null);
    setForm({
      ...emptyForm,
      name: product.name,
      categorySlug: product.categorySlug,
      pageTemplate: product.pageTemplate ?? "standard",
      sku: product.sku,
      shortDescription: product.shortDescription,
      description: product.description,
      priceNaira: String(product.priceKobo / 100),
      compareAtNaira: product.compareAtKobo
        ? String(product.compareAtKobo / 100)
        : "",
      supplierCostNaira: product.supplierCostKobo
        ? String(product.supplierCostKobo / 100)
        : "",
      stock: String(product.stock),
      soldCount: String(product.soldCount ?? 0),
      paymentMode: product.paymentMode ?? "prepaid",
      variants: product.variants.join(", "),
      badge: product.badge ?? "",
      imageUrl: product.imageUrl,
      brand: product.brand ?? "",
      model: product.model ?? "",
      materials: product.materials ?? "",
      dimensions: product.dimensions ?? "",
      weight: product.weight ?? "",
      colour: product.colour ?? "",
      size: product.size ?? "",
      warranty: product.warranty ?? "",
      packageContents: product.packageContents ?? "",
      countryOfOrigin: product.countryOfOrigin ?? "",
      careInstructions: product.careInstructions ?? "",
      compatibility: product.compatibility ?? "",
      specifications: Object.entries(product.specifications ?? {})
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n"),
      chatbotKnowledge: product.chatbotKnowledge ?? "",
      chatbotFaq: (product.chatbotFaq ?? [])
        .map((item) => `${item.question} | ${item.answer}`)
        .join("\n"),
      promoEnabled: Boolean(product.promoEnabled),
      promoLabel: product.promoLabel || "PROMO",
      promoEndsAt: product.promoEndsAt || "",
      isFeatured: product.isFeatured,
      isPublished: product.isPublished,
    });
    setLandingPage(normalizeFlexibleProductPage(product, product.landingPage));
    setPrimaryFile(null);
    setGalleryFiles([]);
    setExistingGallery(
      product.gallery?.length ? product.gallery : [product.imageUrl],
    );
    setLocalPreview(product.imageUrl);
    resetStudio();
    setMessage("");
    setProductModalOpen(true);
  }
  function openReviewManager(review?: Review) {
    const selected =
      products.find(
        (product) =>
          product.slug === (review?.productSlug ?? reviewForm.productSlug),
      ) ?? products[0];
    const categorySlug = selected?.categorySlug ?? categories[0]?.slug ?? "";
    const firstProduct = products.find(
      (product) => product.categorySlug === categorySlug,
    );
    setReviewCategory(categorySlug);
    setEditingReviewId(review?.id ?? null);
    setReviewForm(
      review
        ? {
            productSlug: review.productSlug,
            reviewerName: review.reviewerName,
            rating: String(review.rating),
            title: review.title,
            body: review.body,
            isVerifiedPurchase: Boolean(review.isVerifiedPurchase),
            reviewedAt: (review.reviewedAt ?? review.createdAt ?? "").slice(
              0,
              10,
            ),
          }
        : {
            ...emptyReview,
            productSlug: selected?.slug ?? firstProduct?.slug ?? "",
          },
    );
    setReviewMessage("");
    setReviewModalOpen(true);
  }
  async function upload(file: File) {
    const isVideo = file.type.startsWith("video/");
    const maximum = isVideo ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maximum)
      throw new Error(
        isVideo
          ? "Videos must be 50 MB or smaller."
          : "Images must be 15 MB or smaller.",
      );
    const signatureResponse = await fetch("/api/media/signature", {
      method: "POST",
    });
    const signed = await responsePayload<{
      cloudName?: string;
      apiKey?: string;
      timestamp?: number;
      folder?: string;
      signature?: string;
      error?: string;
    }>(signatureResponse);
    if (
      !signatureResponse.ok ||
      !signed.cloudName ||
      !signed.apiKey ||
      !signed.timestamp ||
      !signed.folder ||
      !signed.signature
    )
      throw new Error(signed.error || "Could not authorize the media upload.");
    const body = new FormData();
    body.set("file", file);
    body.set("api_key", signed.apiKey);
    body.set("timestamp", String(signed.timestamp));
    body.set("folder", signed.folder);
    body.set("signature", signed.signature);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/auto/upload`,
      { method: "POST", body },
    );
    const payload = await responsePayload<{
      secure_url?: string;
      error?: { message?: string };
    }>(response);
    if (!response.ok || !payload.secure_url)
      throw new Error(
        payload.error?.message || "Cloudinary could not store this media file.",
      );
    return payload.secure_url;
  }
  async function enhance(file: File) {
    const body = new FormData();
    body.set("file", file);
    body.set("mode", enhancementMode);
    const response = await fetch("/api/media/enhance", {
      method: "POST",
      body,
    });
    const payload = await responsePayload<{ url?: string; error?: string }>(
      response,
    );
    if (!response.ok || !payload.url)
      throw new Error(payload.error || "AI enhancement failed.");
    return payload.url;
  }
  async function prepareCover(file: File | null) {
    if (!file) {
      setPrimaryFile(null);
      setOriginalCoverPreview("");
      setEnhancedCoverUrl("");
      setLocalPreview(form.imageUrl);
      return;
    }
    const original = URL.createObjectURL(file);
    setOriginalCoverPreview(original);
    setLocalPreview(original);
    setStudioStatus("Optimizing cover image for fast loading…");
    try {
      const optimized = await optimizeProductImage(file);
      setPrimaryFile(optimized);
      setLocalPreview(URL.createObjectURL(optimized));
      if (aiStudioEnabled) {
        setStudioStatus("AI Product Studio is improving the cover…");
        const url = await enhance(optimized);
        setEnhancedCoverUrl(url);
        setLocalPreview(url);
        setStudioStatus(
          "AI enhancement is ready. Review it before publishing.",
        );
      } else
        setStudioStatus(
          `Optimized locally · ${Math.max(1, Math.round(optimized.size / 1024))} KB`,
        );
    } catch (error) {
      setStudioStatus(
        error instanceof Error
          ? `${error.message} The locally optimized image will be used.`
          : "The locally optimized image will be used.",
      );
    }
  }
  async function prepareGallery(files: File[]) {
    const prepared: File[] = [];
    for (const file of files) {
      if (file.type.startsWith("video/")) {
        prepared.push(file);
        continue;
      }
      setStudioStatus(`Optimizing ${file.name}…`);
      try {
        const optimized = await optimizeProductImage(file);
        prepared.push(optimized);
        if (aiStudioEnabled) {
          setStudioStatus(`AI Product Studio is improving ${file.name}…`);
          const url = await enhance(optimized);
          setEnhancedGalleryUrls((current) => ({
            ...current,
            [fileKey(optimized)]: url,
          }));
        }
      } catch (error) {
        prepared.push(file);
        setStudioStatus(
          error instanceof Error
            ? error.message
            : "One image could not be optimized.",
        );
      }
    }
    addGalleryFiles(prepared);
    setStudioStatus(
      "Gallery preparation complete. Review each image before publishing.",
    );
  }
  function addGalleryFiles(files: File[]) {
    setGalleryFiles((current) => {
      const combined = [...current, ...files];
      return combined.filter(
        (file, index) =>
          combined.findIndex(
            (item) =>
              item.name === file.name &&
              item.size === file.size &&
              item.lastModified === file.lastModified,
          ) === index,
      );
    });
  }
  function removeExistingMedia(url: string) {
    setExistingGallery((current) => current.filter((item) => item !== url));
  }
  function removeNewMedia(file: File) {
    setGalleryFiles((current) => current.filter((item) => item !== file));
  }
  function mediaKind(file: File) {
    return file.type.startsWith("video/") ? "video" : "image";
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      let imageUrl = form.imageUrl;
      if (enhancedCoverUrl) imageUrl = enhancedCoverUrl;
      else if (primaryFile) {
        setMessage("Uploading cover image…");
        imageUrl = await upload(primaryFile);
      }
      if (!imageUrl) throw new Error("Choose a cover image for product cards.");
      const uploadedGallery: string[] = [];
      for (const media of galleryFiles) {
        setMessage(`Uploading ${media.name}…`);
        uploadedGallery.push(
          enhancedGalleryUrls[fileKey(media)] || (await upload(media)),
        );
      }
      const gallery = Array.from(
        new Set([imageUrl, ...existingGallery, ...uploadedGallery]),
      );
      setMessage(
        editingId ? "Saving product changes…" : "Publishing to catalogue…",
      );
      const response = await fetch("/api/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          id: editingId,
          imageUrl,
          gallery,
          landingPage,
          variants: form.variants
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const payload = await responsePayload<{
        product?: Record<string, unknown>;
        error?: string;
      }>(response);
      if (!response.ok || !payload.product)
        throw new Error(payload.error || "Product save failed.");
      const saved = rawProduct(payload.product);
      saved.gallery = gallery;
      setProducts((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? saved : item))
          : [saved, ...current],
      );
      setMessage(
        `${editingId ? "Updated" : "Published"} “${saved.name}” successfully.`,
      );
      window.setTimeout(() => setProductModalOpen(false), 800);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setReviewMessage("Saving review…");
    try {
      const response = await fetch("/api/reviews", {
        method: editingReviewId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...reviewForm, id: editingReviewId }),
      });
      const payload = (await response.json()) as {
        review?: Review;
        error?: string;
      };
      if (!response.ok || !payload.review)
        throw new Error(payload.error || "Review save failed.");
      setReviews((current) =>
        editingReviewId
          ? current.map((item) =>
              item.id === editingReviewId ? payload.review! : item,
            )
          : [payload.review!, ...current],
      );
      setReviewMessage(
        editingReviewId
          ? "Review updated successfully."
          : "Review added successfully.",
      );
      setReviewForm({ ...emptyReview, productSlug: reviewForm.productSlug });
      setEditingReviewId(null);
      window.setTimeout(() => setReviewModalOpen(false), 700);
    } catch (error) {
      setReviewMessage(
        error instanceof Error ? error.message : "Review save failed.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function removeReview(review: Review) {
    if (!review.id) return;
    const response = await fetch(`/api/reviews?id=${review.id}`, {
      method: "DELETE",
    });
    if (response.ok)
      setReviews((current) => current.filter((item) => item.id !== review.id));
  }
  async function removeProduct(product: Product) {
    if (!product.id || deletingId !== null) return;
    const confirmed = window.confirm(
      `Delete “${product.name}”?\n\nThis permanently removes the product listing and its reviews. Historical order records will remain available.`,
    );
    if (!confirmed) return;
    setDeletingId(product.id);
    setCatalogueMessage(`Deleting “${product.name}”…`);
    try {
      const response = await fetch(`/api/products?id=${product.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error || "Product deletion failed.");
      const remaining = products.filter((item) => item.id !== product.id);
      setProducts(remaining);
      setReviews((current) =>
        current.filter((review) => review.productSlug !== product.slug),
      );
      if (reviewForm.productSlug === product.slug) {
        const replacement =
          remaining.find((item) => item.categorySlug === reviewCategory) ??
          remaining[0];
        setReviewCategory(
          replacement?.categorySlug ?? categories[0]?.slug ?? "",
        );
        setReviewForm((current) => ({
          ...current,
          productSlug: replacement?.slug ?? "",
        }));
      }
      setCatalogueMessage(`“${product.name}” was deleted.`);
    } catch (error) {
      setCatalogueMessage(
        error instanceof Error ? error.message : "Product deletion failed.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">
          <img src="/renova-mark.svg" alt="" />
          <span>
            <b>RENOVA</b>
            <small>OWNER CONSOLE</small>
          </span>
        </Link>
        <nav>
          <a className="active" href="#overview">
            <span>⌂</span>Overview
          </a>
          <a href="#categories">
            <span>⌘</span>Categories
          </a>
          <a href="#catalogue">
            <span>□</span>Products
          </a>
          <a href="#orders">
            <span>▤</span>Orders <i>{orderRows.length}</i>
          </a>
          <a href="#reviews">
            <span>☆</span>Reviews <i>{reviews.length}</i>
          </a>
        </nav>
        <div className="admin-sidebar-foot">
          <span className="status-dot" />
          Private owner workspace<Link href="/">Open storefront ↗</Link>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">Owner workspace</span>
            <h1>Good day, {ownerName.split(" ")[0]}.</h1>
          </div>
          <button className="button primary" onClick={() => openNew()}>
            ＋ New product
          </button>
        </header>
        <section className="admin-notice">
          <b>Owner-only catalogue control</b>
          <span>
            Add or edit products by department, upload product images or videos,
            control stock and pricing, and manage approved customer reviews.
          </span>
        </section>
        <section id="overview" className="admin-metrics">
          <article>
            <span>Published products</span>
            <strong>
              {products.filter((item) => item.isPublished).length}
            </strong>
            <small>Across {categories.length} departments</small>
          </article>
          <article>
            <span>Catalogue value</span>
            <strong>{formatNaira(revenueEstimate)}</strong>
            <small>Current inventory estimate</small>
          </article>
          <article>
            <span>Paid orders</span>
            <strong>
              {
                orderRows.filter((order) => order.paymentStatus === "paid")
                  .length
              }
            </strong>
            <small>Verified prepaid orders</small>
          </article>
          <article>
            <span>Needs attention</span>
            <strong>{products.filter((item) => item.stock < 10).length}</strong>
            <small>Low-stock products</small>
          </article>
        </section>

        <section className="admin-panel" id="categories">
          <div className="admin-panel-head">
            <div>
              <span className="eyebrow">Department manager</span>
              <h2>Choose a category</h2>
            </div>
          </div>
          <div className="admin-category-grid">
            {categories.map((category) => {
              const count = products.filter(
                (product) => product.categorySlug === category.slug,
              ).length;
              return (
                <article key={category.slug}>
                  <img src={category.imageUrl} alt="" />
                  <div>
                    <span>{category.monogram}</span>
                    <h3>{category.name}</h3>
                    <p>
                      {count} product{count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button onClick={() => openNew(category.slug)}>
                    ＋ Add here
                  </button>
                  <button
                    className="category-view"
                    onClick={() => {
                      setFilter(category.slug);
                      document
                        .getElementById("catalogue")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Manage
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="admin-panel" id="catalogue">
          <div className="admin-panel-head">
            <div>
              <span className="eyebrow">Catalogue</span>
              <h2>
                {filter === "all" ? "All products" : categoryName(filter)}
              </h2>
            </div>
            <div className="catalogue-tools">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products or SKU"
              />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option value={category.slug} key={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => openNew(filter === "all" ? undefined : filter)}
              >
                Add product
              </button>
            </div>
          </div>
          <div className="admin-product-table">
            <div className="table-row table-heading">
              <span>Product</span>
              <span>Category</span>
              <span>Price</span>
              <span>Stock</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {visibleProducts.map((product) => (
              <div className="table-row" key={product.slug}>
                <span className="admin-product-name">
                  <img src={product.imageUrl} alt="" />
                  <span>
                    <b>{product.name}</b>
                    <small>
                      {product.sku} · {product.gallery?.length ?? 1} media
                    </small>
                  </span>
                </span>
                <span>{categoryName(product.categorySlug)}</span>
                <span>{formatNaira(product.priceKobo)}</span>
                <span>{product.stock}</span>
                <span>
                  <i className={product.isPublished ? "published" : "draft"}>
                    {product.isPublished ? "Published" : "Draft"}
                  </i>
                </span>
                <span className="table-actions">
                  <button onClick={() => openEdit(product)}>Edit</button>
                  <Link href={productHref(product)}>Preview ↗</Link>
                  <button
                    type="button"
                    className="delete-action"
                    disabled={deletingId === product.id}
                    onClick={() => void removeProduct(product)}
                  >
                    {deletingId === product.id ? "Deleting…" : "Delete"}
                  </button>
                </span>
              </div>
            ))}
          </div>
          {catalogueMessage && (
            <p className="catalogue-action-message" role="status">
              {catalogueMessage}
            </p>
          )}
        </section>

        <section className="admin-panel" id="reviews">
          <div className="admin-panel-head">
            <div>
              <span className="eyebrow">Trust & feedback</span>
              <h2>Product reviews</h2>
            </div>
            <button
              className="button espresso"
              onClick={() => openReviewManager()}
            >
              ＋ Add review
            </button>
          </div>
          <div className="admin-review-list">
            {reviews.slice(0, 30).map((review) => (
              <article
                key={
                  review.id ?? `${review.productSlug}-${review.reviewerName}`
                }
              >
                <div>
                  <span>{"★".repeat(review.rating)}</span>
                  <i
                    className={
                      review.isVerifiedPurchase ? "verified" : "unverified"
                    }
                  >
                    {review.isVerifiedPurchase
                      ? "Verified purchase"
                      : "Not verified"}
                  </i>
                </div>
                <h3>{review.title}</h3>
                <p>{review.body}</p>
                <footer>
                  <b>{review.reviewerName}</b>
                  <small>
                    {products.find(
                      (product) => product.slug === review.productSlug,
                    )?.name ?? review.productSlug}
                  </small>
                  <small>
                    {review.reviewedAt || review.createdAt
                      ? new Date(
                          review.reviewedAt ?? review.createdAt!,
                        ).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Date not set"}
                  </small>
                  <span className="admin-review-actions">
                    <button
                      type="button"
                      onClick={() => openReviewManager(review)}
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => removeReview(review)}>
                      Remove
                    </button>
                  </span>
                </footer>
              </article>
            ))}
          </div>
        </section>
        <section className="admin-panel" id="orders">
          <div className="admin-panel-head">
            <div>
              <span className="eyebrow">Fulfilment</span>
              <h2>Recent orders</h2>
            </div>
          </div>
          {orderMessage && (
            <p className="admin-order-message">{orderMessage}</p>
          )}
          {orderRows.length ? (
            <div className="admin-order-list">
              {orderRows.slice(0, 20).map((order) => (
                <article key={order.id}>
                  <b>{order.orderNumber}</b>
                  <span>{order.customerName}</span>
                  <span>{formatNaira(order.totalKobo)}</span>
                  <i>
                    {order.paymentMethod === "cash_on_delivery"
                      ? "Pay on delivery"
                      : order.paymentStatus}
                  </i>
                  <small>
                    {new Date(order.createdAt).toLocaleDateString("en-NG")}
                  </small>
                  <select
                    aria-label={`Status for ${order.orderNumber}`}
                    value={order.status}
                    onChange={(event) =>
                      updateOrderStatus(order, event.target.value)
                    }
                  >
                    {[
                      "confirmed",
                      "processing",
                      "packaged",
                      "dispatched",
                      "delivered",
                      "refunded",
                    ].map((status) => (
                      <option value={status} key={status}>
                        {status.replace(/^./, (character) =>
                          character.toUpperCase(),
                        )}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-empty">
              <h3>No orders yet</h3>
              <p>
                Prepaid and payment-on-delivery orders will appear here
                automatically.
              </p>
            </div>
          )}
        </section>
      </main>

      {productModalOpen && (
        <div className="product-modal" role="dialog" aria-modal="true">
          <button
            className="modal-scrim"
            onClick={() => !saving && setProductModalOpen(false)}
            aria-label="Close"
          />
          <form className="product-form" onSubmit={submitProduct}>
            <header>
              <div>
                <span className="eyebrow">Catalogue builder</span>
                <h2>{editingId ? "Edit product" : "Add a new product"}</h2>
                <p>Everything here updates the storefront catalogue.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setProductModalOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="form-layout">
              <div className="form-primary">
                <fieldset>
                  <legend>1. Product details</legend>
                  <label>
                    Product name
                    <input
                      required
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                    />
                  </label>
                  <div className="form-two">
                    <label>
                      Category
                      <select
                        value={form.categorySlug}
                        onChange={(e) =>
                          updateField("categorySlug", e.target.value)
                        }
                      >
                        {categories.map((category) => (
                          <option value={category.slug} key={category.slug}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      SKU <small>Optional for new products</small>
                      <input
                        value={form.sku}
                        onChange={(e) => updateField("sku", e.target.value)}
                        placeholder="Auto-generated if blank"
                      />
                    </label>
                  </div>
                  <label>
                    Short sales description
                    <input
                      required
                      value={form.shortDescription}
                      onChange={(e) =>
                        updateField("shortDescription", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Full description
                    <textarea
                      rows={6}
                      value={form.description}
                      onChange={(e) =>
                        updateField("description", e.target.value)
                      }
                      placeholder="Benefits, specifications, dimensions and what is included"
                    />
                  </label>
                </fieldset>
                <fieldset className="page-template-fields">
                  <legend>2. Product page type</legend>
                  <p>
                    Choose the standard Renova catalogue page or a fully
                    configurable campaign page for ads.
                  </p>
                  <div className="template-choice-grid">
                    <label
                      className={
                        form.pageTemplate === "standard" ? "selected" : ""
                      }
                    >
                      <input
                        type="radio"
                        name="pageTemplate"
                        value="standard"
                        checked={form.pageTemplate === "standard"}
                        onChange={() => updateField("pageTemplate", "standard")}
                      />
                      <b>Standard ecommerce page</b>
                      <span>
                        Uses Renova’s normal product, cart and checkout
                        experience.
                      </span>
                    </label>
                    <label
                      className={
                        form.pageTemplate === "flexible" ? "selected" : ""
                      }
                    >
                      <input
                        type="radio"
                        name="pageTemplate"
                        value="flexible"
                        checked={form.pageTemplate === "flexible"}
                        onChange={() => updateField("pageTemplate", "flexible")}
                      />
                      <b>Flexible campaign page</b>
                      <span>
                        A long-form, themeable sales page at
                        /offers/product-name.
                      </span>
                    </label>
                  </div>
                  {form.pageTemplate === "flexible" && (
                    <FlexiblePageEditor
                      value={landingPage}
                      onChange={setLandingPage}
                    />
                  )}
                </fieldset>
                <fieldset className="promo-admin-fields">
                  <legend>3. Optional product promotion</legend>
                  <p>
                    Add a prominent promotional banner and a real two-hour
                    countdown to this product page. Products remain unchanged
                    when this is switched off.
                  </p>
                  <label className="check-row promo-admin-toggle">
                    <input
                      type="checkbox"
                      checked={form.promoEnabled}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        setForm((current) => ({
                          ...current,
                          promoEnabled: enabled,
                          promoEndsAt: enabled
                            ? new Date(
                                Date.now() + 2 * 60 * 60 * 1000,
                              ).toISOString()
                            : "",
                        }));
                      }}
                    />
                    <span>
                      <b>Show animated promo</b>
                      <small>
                        Displays only on this product while its timer is active.
                      </small>
                    </span>
                  </label>
                  {form.promoEnabled && (
                    <div className="promo-admin-active">
                      <label>
                        Promo wording
                        <input
                          value={form.promoLabel}
                          maxLength={28}
                          onChange={(event) =>
                            updateField("promoLabel", event.target.value)
                          }
                          placeholder="PROMO"
                        />
                      </label>
                      <div>
                        <b>Fixed two-hour countdown</b>
                        <span>
                          Ends {new Date(form.promoEndsAt).toLocaleString("en-NG")}
                        </span>
                        <button
                          type="button"
                          className="button quiet"
                          onClick={() =>
                            updateField(
                              "promoEndsAt",
                              new Date(
                                Date.now() + 2 * 60 * 60 * 1000,
                              ).toISOString(),
                            )
                          }
                        >
                          Restart two-hour timer
                        </button>
                      </div>
                    </div>
                  )}
                </fieldset>
                <fieldset>
                  <legend>4. Specifications customers can trust</legend>
                  <div className="form-two">
                    <label>
                      Brand
                      <input
                        value={form.brand}
                        onChange={(e) => updateField("brand", e.target.value)}
                      />
                    </label>
                    <label>
                      Model
                      <input
                        value={form.model}
                        onChange={(e) => updateField("model", e.target.value)}
                      />
                    </label>
                    <label>
                      Materials
                      <input
                        value={form.materials}
                        onChange={(e) =>
                          updateField("materials", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Dimensions
                      <input
                        value={form.dimensions}
                        onChange={(e) =>
                          updateField("dimensions", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Weight
                      <input
                        value={form.weight}
                        onChange={(e) => updateField("weight", e.target.value)}
                      />
                    </label>
                    <label>
                      Colours
                      <input
                        value={form.colour}
                        onChange={(e) => updateField("colour", e.target.value)}
                      />
                    </label>
                    <label>
                      Size
                      <input
                        value={form.size}
                        onChange={(e) => updateField("size", e.target.value)}
                      />
                    </label>
                    <label>
                      Warranty
                      <input
                        value={form.warranty}
                        onChange={(e) =>
                          updateField("warranty", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Country of origin
                      <input
                        value={form.countryOfOrigin}
                        onChange={(e) =>
                          updateField("countryOfOrigin", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Compatibility
                      <input
                        value={form.compatibility}
                        onChange={(e) =>
                          updateField("compatibility", e.target.value)
                        }
                      />
                    </label>
                  </div>
                  <label>
                    What is in the box
                    <textarea
                      rows={3}
                      value={form.packageContents}
                      onChange={(e) =>
                        updateField("packageContents", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Care instructions
                    <textarea
                      rows={3}
                      value={form.careInstructions}
                      onChange={(e) =>
                        updateField("careInstructions", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Additional specifications{" "}
                    <small>One “Label: Value” per line</small>
                    <textarea
                      rows={5}
                      value={form.specifications}
                      onChange={(e) =>
                        updateField("specifications", e.target.value)
                      }
                      placeholder={"Battery: 5,000 mAh\nDisplay: 6.5 inch"}
                    />
                  </label>
                </fieldset>
                <fieldset className="assistant-fields">
                  <legend>5. Product assistant knowledge</legend>
                  <p>
                    Only add approved customer-facing facts. Private supplier
                    details are never sent to the AI provider.
                  </p>
                  <label>
                    Knowledge notes
                    <textarea
                      rows={7}
                      value={form.chatbotKnowledge}
                      onChange={(e) =>
                        updateField("chatbotKnowledge", e.target.value)
                      }
                      placeholder="Explain use cases, setup, delivery expectations, limitations and approved answers."
                    />
                  </label>
                  <label>
                    Frequently asked questions{" "}
                    <small>One “Question | Answer” per line</small>
                    <textarea
                      rows={6}
                      value={form.chatbotFaq}
                      onChange={(e) =>
                        updateField("chatbotFaq", e.target.value)
                      }
                      placeholder={
                        "Is it rechargeable? | Yes, using the included USB-C cable.\nWhen will it arrive? | Usually within 3–5 working days."
                      }
                    />
                  </label>
                </fieldset>
                <fieldset>
                  <legend>6. Pricing, discount and stock</legend>
                  <div className="form-three">
                    <label>
                      Current selling price (₦)
                      <input
                        required
                        type="number"
                        min="0"
                        value={form.priceNaira}
                        onChange={(e) =>
                          updateField("priceNaira", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Previous / compare price (₦)
                      <input
                        type="number"
                        min="0"
                        value={form.compareAtNaira}
                        onChange={(e) =>
                          updateField("compareAtNaira", e.target.value)
                        }
                      />
                      <small>Shown with a strike-through when higher.</small>
                    </label>
                    <label>
                      Stock quantity
                      <input
                        required
                        type="number"
                        min="0"
                        value={form.stock}
                        onChange={(e) => updateField("stock", e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="form-two">
                    <label>
                      Number sold
                      <input
                        required
                        type="number"
                        min="0"
                        value={form.soldCount}
                        onChange={(e) =>
                          updateField("soldCount", e.target.value)
                        }
                      />
                      <small>
                        You can set an existing verified sales total. New
                        completed sales are added automatically.
                      </small>
                    </label>
                    <label>
                      Customer payment option
                      <select
                        value={form.paymentMode}
                        onChange={(e) =>
                          updateField("paymentMode", e.target.value)
                        }
                      >
                        <option value="prepaid">
                          Prepaid securely with Paystack
                        </option>
                        <option value="cash_on_delivery">
                          Payment on delivery
                        </option>
                      </select>
                      <small>
                        This determines the checkout used for this product.
                      </small>
                    </label>
                  </div>
                  <label>
                    Variants <small>Separate with commas</small>
                    <input
                      value={form.variants}
                      onChange={(e) => updateField("variants", e.target.value)}
                    />
                  </label>
                  <label>
                    Promotion label <small>Optional</small>
                    <input
                      value={form.badge}
                      onChange={(e) => updateField("badge", e.target.value)}
                    />
                  </label>
                </fieldset>
                <fieldset className="private-fields">
                  <legend>7. Private supplier information</legend>
                  <p>
                    These fields stay in the owner database and never appear on
                    the storefront.
                  </p>
                  <div className="form-two">
                    <label>
                      Supplier name
                      <input
                        value={form.supplierName}
                        onChange={(e) =>
                          updateField("supplierName", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Supplier cost (₦)
                      <input
                        type="number"
                        min="0"
                        value={form.supplierCostNaira}
                        onChange={(e) =>
                          updateField("supplierCostNaira", e.target.value)
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Supplier product URL
                    <input
                      type="url"
                      value={form.supplierUrl}
                      onChange={(e) =>
                        updateField("supplierUrl", e.target.value)
                      }
                    />
                  </label>
                </fieldset>
              </div>
              <aside className="form-media">
                <fieldset className="ai-product-studio">
                  <legend>AI Product Studio</legend>
                  <div className="ai-studio-title">
                    <span>✦</span>
                    <div>
                      <b>Polish product photos before they go live</b>
                      <small>
                        Images are compressed automatically. AI enhancement is
                        optional and never changes videos.
                      </small>
                    </div>
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={aiStudioEnabled}
                      onChange={(event) =>
                        setAiStudioEnabled(event.target.checked)
                      }
                    />
                    <span>
                      <b>Enhance new images with AI</b>
                      <small>Requires OPENAI_API_KEY on the server.</small>
                    </span>
                  </label>
                  <label>
                    Image style
                    <select
                      value={enhancementMode}
                      onChange={(event) =>
                        setEnhancementMode(event.target.value)
                      }
                    >
                      <option value="studio">
                        Bright white product studio
                      </option>
                      <option value="background">
                        Replace background with pure white
                      </option>
                      <option value="natural">Natural light correction</option>
                    </select>
                  </label>
                  <p className="ai-safety-note">
                    AI must preserve the real product. Check colour, shape,
                    labels, included items and logos before publishing.
                  </p>
                  {studioStatus && (
                    <p className="ai-studio-status">
                      <i />
                      {studioStatus}
                    </p>
                  )}
                </fieldset>
                <fieldset>
                  <legend>Cover image</legend>
                  <label className="media-drop">
                    <input
                      required={!form.imageUrl}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={(e) =>
                        void prepareCover(e.target.files?.[0] ?? null)
                      }
                    />
                    {localPreview ? (
                      <img src={localPreview} alt="Product cover preview" />
                    ) : (
                      <>
                        <b>＋</b>
                        <strong>Choose cover image</strong>
                        <span>Used on product cards and social previews.</span>
                      </>
                    )}
                  </label>
                  {originalCoverPreview && (
                    <div className="ai-before-after">
                      <article>
                        <span>Original</span>
                        <img
                          src={originalCoverPreview}
                          alt="Original uploaded product"
                        />
                      </article>
                      <article>
                        <span>
                          {enhancedCoverUrl ? "AI enhanced" : "Optimized"}
                        </span>
                        <img src={localPreview} alt="Prepared product" />
                      </article>
                    </div>
                  )}
                  {enhancedCoverUrl && (
                    <div className="ai-approval">
                      <b>Enhanced version selected</b>
                      <button
                        type="button"
                        onClick={() => {
                          setEnhancedCoverUrl("");
                          if (primaryFile)
                            setLocalPreview(URL.createObjectURL(primaryFile));
                          setStudioStatus(
                            "Keeping the locally optimized original.",
                          );
                        }}
                      >
                        Keep optimized original instead
                      </button>
                    </div>
                  )}
                </fieldset>
                <fieldset>
                  <legend>Images & videos</legend>
                  <div className="gallery-upload-heading">
                    <b>
                      {
                        Array.from(
                          new Set(
                            [
                              form.imageUrl,
                              ...existingGallery,
                              ...galleryFiles.map((file) => file.name),
                            ].filter(Boolean),
                          ),
                        ).length
                      }{" "}
                      media selected
                    </b>
                    <span>
                      Add up to five useful product views plus short
                      demonstration videos.
                    </span>
                  </div>
                  <label className="media-gallery-drop">
                    <input
                      multiple
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
                      onChange={(e) => {
                        void prepareGallery(Array.from(e.target.files ?? []));
                        e.currentTarget.value = "";
                      }}
                    />
                    <b>＋ Upload images or videos</b>
                    <span>
                      JPG, PNG, WebP or AVIF up to 15 MB · MP4 or WebM up to 50
                      MB
                    </span>
                  </label>
                  <div className="admin-media-grid">
                    {existingGallery
                      .filter((url) => url !== form.imageUrl)
                      .map((url, index) => (
                        <article key={url}>
                          {/\.(mp4|webm)(?:\?|$)/i.test(url) ? (
                            <video
                              src={url}
                              controls
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <img
                              src={url}
                              alt={`Existing gallery item ${index + 1}`}
                            />
                          )}
                          <span>
                            {/\.(mp4|webm)(?:\?|$)/i.test(url)
                              ? "Saved video"
                              : `Saved image ${index + 2}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeExistingMedia(url)}
                            aria-label={`Remove saved gallery item ${index + 1}`}
                          >
                            ×
                          </button>
                        </article>
                      ))}
                    {galleryFiles.map((media, index) => {
                      const enhanced = enhancedGalleryUrls[fileKey(media)];
                      return (
                        <article
                          className={enhanced ? "ai-ready" : ""}
                          key={`${media.name}-${media.lastModified}`}
                        >
                          {mediaKind(media) === "video" ? (
                            <video
                              src={URL.createObjectURL(media)}
                              controls
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <img
                              src={enhanced || URL.createObjectURL(media)}
                              alt={`New gallery item ${index + 1}`}
                            />
                          )}
                          <span>
                            {enhanced
                              ? "✦ AI ready"
                              : mediaKind(media) === "video"
                                ? "New video"
                                : "Optimized image"}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeNewMedia(media)}
                            aria-label={`Remove ${media.name}`}
                          >
                            ×
                          </button>
                          {enhanced && (
                            <button
                              type="button"
                              className="keep-original"
                              onClick={() =>
                                setEnhancedGalleryUrls((current) => {
                                  const next = { ...current };
                                  delete next[fileKey(media)];
                                  return next;
                                })
                              }
                            >
                              Use original
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                  <p className="gallery-admin-note">
                    The cover appears first. Customers can use thumbnails,
                    arrows, or swipe left and right on phones.
                  </p>
                </fieldset>
                <fieldset>
                  <legend>Publishing</legend>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={form.isPublished}
                      onChange={(e) =>
                        updateField("isPublished", e.target.checked)
                      }
                    />
                    <span>
                      <b>Publish immediately</b>
                      <small>Turn off to save as a draft.</small>
                    </span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={form.isFeatured}
                      onChange={(e) =>
                        updateField("isFeatured", e.target.checked)
                      }
                    />
                    <span>
                      <b>Feature on homepage</b>
                      <small>Add it to the curated collection.</small>
                    </span>
                  </label>
                </fieldset>
                <div className="form-summary">
                  <span>Customer price</span>
                  <strong>
                    {form.priceNaira
                      ? `₦${Number(form.priceNaira).toLocaleString("en-NG")}`
                      : "₦0"}
                  </strong>
                  <small>
                    {form.compareAtNaira
                      ? `Previous price ₦${Number(form.compareAtNaira).toLocaleString("en-NG")}`
                      : "No compare-at price"}
                  </small>
                </div>
              </aside>
            </div>
            <footer>
              <span
                className={
                  message.toLowerCase().includes("failed") ||
                  message.toLowerCase().includes("required")
                    ? "error-message"
                    : "save-message"
                }
              >
                {message}
              </span>
              <button
                type="button"
                className="button quiet"
                onClick={() => setProductModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="button primary"
              >
                {saving
                  ? "Working…"
                  : editingId
                    ? "Save changes"
                    : form.isPublished
                      ? "Publish product"
                      : "Save draft"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {reviewModalOpen && (
        <div className="product-modal" role="dialog" aria-modal="true">
          <button
            className="modal-scrim"
            onClick={() => setReviewModalOpen(false)}
            aria-label="Close"
          />
          <form className="review-form" onSubmit={submitReview}>
            <header>
              <div>
                <span className="eyebrow">Review manager</span>
                <h2>
                  {editingReviewId
                    ? "Edit product review"
                    : "Add a product review"}
                </h2>
                <p>
                  Add genuine customer feedback only when you have permission to
                  publish it.
                </p>
              </div>
              <button type="button" onClick={() => setReviewModalOpen(false)}>
                ×
              </button>
            </header>
            <div>
              <div className="form-two review-product-picker">
                <label>
                  Category
                  <select
                    required
                    value={reviewCategory}
                    onChange={(e) => {
                      const categorySlug = e.target.value;
                      const firstProduct = products.find(
                        (product) => product.categorySlug === categorySlug,
                      );
                      setReviewCategory(categorySlug);
                      setReviewForm((current) => ({
                        ...current,
                        productSlug: firstProduct?.slug ?? "",
                      }));
                    }}
                  >
                    {categories.map((category) => (
                      <option value={category.slug} key={category.slug}>
                        {category.name} (
                        {
                          products.filter(
                            (product) => product.categorySlug === category.slug,
                          ).length
                        }
                        )
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Product
                  <select
                    required
                    disabled={!reviewProducts.length}
                    value={reviewForm.productSlug}
                    onChange={(e) =>
                      setReviewForm((current) => ({
                        ...current,
                        productSlug: e.target.value,
                      }))
                    }
                  >
                    {reviewProducts.map((product) => (
                      <option value={product.slug} key={product.slug}>
                        {product.name} · {product.sku}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!reviewProducts.length && (
                <p className="review-category-empty">
                  No products are currently available in this category.
                </p>
              )}
              <div className="form-two">
                <label>
                  Reviewer name
                  <input
                    required
                    value={reviewForm.reviewerName}
                    onChange={(e) =>
                      setReviewForm((current) => ({
                        ...current,
                        reviewerName: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Rating
                  <select
                    value={reviewForm.rating}
                    onChange={(e) =>
                      setReviewForm((current) => ({
                        ...current,
                        rating: e.target.value,
                      }))
                    }
                  >
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating} star{rating === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-two review-metadata-fields">
                <label>
                  Review date <small>Optional</small>
                  <input
                    type="date"
                    value={reviewForm.reviewedAt}
                    onChange={(e) =>
                      setReviewForm((current) => ({
                        ...current,
                        reviewedAt: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="review-verification-control">
                  <input
                    type="checkbox"
                    checked={reviewForm.isVerifiedPurchase}
                    onChange={(e) =>
                      setReviewForm((current) => ({
                        ...current,
                        isVerifiedPurchase: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    <b>Verified purchase</b>
                    <small>
                      Use only when this review belongs to a confirmed paid
                      order.
                    </small>
                  </span>
                </label>
              </div>
              <label>
                Review title
                <input
                  required
                  value={reviewForm.title}
                  onChange={(e) =>
                    setReviewForm((current) => ({
                      ...current,
                      title: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Review text
                <textarea
                  required
                  rows={5}
                  value={reviewForm.body}
                  onChange={(e) =>
                    setReviewForm((current) => ({
                      ...current,
                      body: e.target.value,
                    }))
                  }
                />
              </label>
              {reviewMessage && <p className="save-message">{reviewMessage}</p>}
            </div>
            <footer>
              <button
                type="button"
                className="button quiet"
                onClick={() => setReviewModalOpen(false)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={saving}>
                {saving
                  ? "Saving…"
                  : editingReviewId
                    ? "Save changes"
                    : "Add review"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
