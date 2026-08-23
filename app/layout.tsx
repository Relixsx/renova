import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "./components/cart-provider";
import { CookieConsent } from "./components/cookie-consent";
import { MetaPageTracker } from "./components/meta-page-tracker";
import { SITE_URL } from "./lib/site";

export const metadata: Metadata = {
  title: {
    default: "Renova Store — Everyday finds, renewed.",
    template: "%s | Renova",
  },
  description: "A warm, Nigeria-first online store for thoughtfully selected technology, fashion, beauty, home and everyday essentials.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Renova Store — Everyday finds, renewed.",
    description: "Thoughtfully selected everyday finds, delivered across Nigeria.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Renova — Everyday finds, renewed." }],
    type: "website",
    url: SITE_URL,
    siteName: "Renova Store",
  },
  twitter: {
    card: "summary_large_image",
    title: "Renova Store — Everyday finds, renewed.",
    description: "Thoughtfully selected everyday finds, delivered across Nigeria.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationJsonLd = { "@context": "https://schema.org", "@type": "OnlineStore", name: "Renova Store", url: SITE_URL, logo: `${SITE_URL}/renova-mark.svg`, image: `${SITE_URL}/og.png`, email: "support@shoprenova.com.ng", address: { "@type": "PostalAddress", addressLocality: "Lagos", addressCountry: "NG" }, paymentAccepted: "Paystack", areaServed: { "@type": "Country", name: "Nigeria" } };
  return (
    <html lang="en">
      <body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }}/><CartProvider>{children}<MetaPageTracker/><CookieConsent /></CartProvider></body>
    </html>
  );
}
