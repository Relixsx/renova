import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "./components/cart-provider";

export const metadata: Metadata = {
  title: {
    default: "Renova Store — Everyday finds, renewed.",
    template: "%s | Renova",
  },
  description: "A warm, Nigeria-first online store for thoughtfully selected technology, fashion, beauty, home and everyday essentials.",
  metadataBase: new URL("https://renova-store.relixsx.chatgpt.site"),
  openGraph: {
    title: "Renova Store — Everyday finds, renewed.",
    description: "Thoughtfully selected everyday finds, delivered across Nigeria.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Renova — Everyday finds, renewed." }],
    type: "website",
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
  return (
    <html lang="en">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
