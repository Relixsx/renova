import type { Metadata } from "next";
export const metadata: Metadata = { title: "Secure Checkout", description: "Complete your Renova delivery details and continue to secure Paystack checkout.", alternates: { canonical: "/checkout" }, robots: { index: false, follow: false } };
export default function CheckoutLayout({ children }: { children: React.ReactNode }) { return children; }
