import type { Metadata } from "next";
export const metadata: Metadata = { title: "Track Your Order", description: "Track a Renova order privately using the order number and checkout email address.", alternates: { canonical: "/track-order" } };
export default function TrackOrderLayout({ children }: { children: React.ReactNode }) { return children; }
