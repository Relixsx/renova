"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Consent = { analytics: boolean; advertising: boolean; updatedAt: string };
const STORAGE_KEY = "renova-consent-v1";

declare global {
  interface Window { fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string }; _fbq?: Window["fbq"]; }
}

function activateMetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return;
  if (window.fbq) {
    window.dispatchEvent(new Event("renova-meta-ready"));
    return;
  }
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args); else fbq.queue?.push(args);
  } as Window["fbq"];
  if (!fbq) return;
  fbq.queue = []; fbq.loaded = true; fbq.version = "2.0";
  window.fbq = fbq; window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true; script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("consent", "grant"); fbq("init", pixelId); fbq("track", "PageView");
  window.dispatchEvent(new Event("renova-meta-ready"));
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) setVisible(true);
      else if ((JSON.parse(saved) as Consent).advertising) activateMetaPixel();
    } catch { setVisible(true); }
    const open = () => { setVisible(true); setCustomizing(true); };
    window.addEventListener("renova-open-privacy", open);
    return () => window.removeEventListener("renova-open-privacy", open);
  }, []);

  function save(next: Omit<Consent, "updatedAt">) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, updatedAt: new Date().toISOString() }));
    if (next.advertising) activateMetaPixel();
    else window.fbq?.("consent", "revoke");
    window.dispatchEvent(new CustomEvent("renova-consent-changed", { detail: next }));
    setVisible(false); setCustomizing(false);
  }

  if (!visible) return null;
  return <section className="consent-banner" role="dialog" aria-modal="true" aria-labelledby="consent-title">
    <div className="consent-copy"><span className="eyebrow">Your privacy choices</span><h2 id="consent-title">You decide what Renova may measure.</h2><p>Essential storage keeps the bag, checkout and security features working. Optional analytics and advertising tools are used only with your permission. Read our <Link href="/privacy">Privacy Notice</Link>.</p></div>
    {customizing && <div className="consent-options">
      <label><span><b>Essential</b><small>Required for shopping, security and consent storage.</small></span><input type="checkbox" checked disabled/></label>
      <label><span><b>Analytics</b><small>Helps us understand site performance and improve shopping journeys.</small></span><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)}/></label>
      <label><span><b>Advertising</b><small>Allows Meta Pixel to measure campaigns and relevant product activity.</small></span><input type="checkbox" checked={advertising} onChange={(event) => setAdvertising(event.target.checked)}/></label>
    </div>}
    <div className="consent-actions">
      {customizing ? <button className="button primary" onClick={() => save({ analytics, advertising })}>Save choices</button> : <button className="button quiet" onClick={() => setCustomizing(true)}>Customize</button>}
      <button className="button quiet" onClick={() => save({ analytics: false, advertising: false })}>Essential only</button>
      <button className="button espresso" onClick={() => save({ analytics: true, advertising: true })}>Accept all</button>
    </div>
  </section>;
}

export function PrivacyChoicesButton() {
  return <button className="footer-privacy-button" onClick={() => window.dispatchEvent(new Event("renova-open-privacy"))}>Privacy choices</button>;
}
