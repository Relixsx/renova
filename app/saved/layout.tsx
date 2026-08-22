import type { Metadata } from "next";
export const metadata: Metadata = { title: "Saved Products", description: "Revisit saved, recently viewed and compared Renova products on this device.", alternates: { canonical: "/saved" }, robots: { index: false, follow: true } };
export default function SavedLayout({ children }: { children: React.ReactNode }) { return children; }
