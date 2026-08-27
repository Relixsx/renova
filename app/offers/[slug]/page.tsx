import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FlexibleProductPage } from "../../components/flexible-product-page";
import { ProductMetaTracker } from "../../components/product-meta-tracker";
import { productHref } from "../../lib/catalog";
import { getProduct, getReviews } from "../../lib/server-catalog";
import { absoluteUrl } from "../../lib/site";

export const dynamic = "force-dynamic";

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
  const url = productHref(product);
  return {
    title: product.name,
    description: product.shortDescription,
    alternates: { canonical: url },
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      url,
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

export default async function OfferPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  if (product.pageTemplate !== "flexible")
    redirect(`/products/${product.slug}`);
  const reviews = await getReviews(slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: (product.gallery?.length ? product.gallery : [product.imageUrl]).map(
      absoluteUrl,
    ),
    description: product.shortDescription,
    sku: product.sku,
    offers: {
      "@type": "Offer",
      priceCurrency: "NGN",
      price: (product.priceKobo / 100).toFixed(2),
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: absoluteUrl(productHref(product)),
    },
  };
  return (
    <>
      <ProductMetaTracker
        slug={product.slug}
        name={product.name}
        value={product.priceKobo / 100}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FlexibleProductPage product={product} reviews={reviews} />
    </>
  );
}
