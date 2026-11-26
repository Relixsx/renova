"use client";

import { useEffect } from "react";
import { reportAnagenDiagnostic } from "../lib/anagen-diagnostics";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
    };
    _fbq?: Window["fbq"];
  }
}

export function MetaPixelLoader() {
  useEffect(() => {
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    if (!pixelId) return;

    if (window.fbq) {
      window.dispatchEvent(new Event("renova-meta-ready"));
      return;
    }

    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    } as NonNullable<Window["fbq"]>;

    if (!fbq) return;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("fetchpriority", "low");
    script.src = "https://connect.facebook.net/en_US/fbevents.js";

    fbq("init", pixelId);
    fbq("track", "PageView");

    const product = document.querySelector<HTMLImageElement>("img[data-anagen-hero-product]");
    if (!product) {
      document.head.appendChild(script);
    } else {
      reportAnagenDiagnostic("meta-pageview-queued");
      script.addEventListener("load", () => reportAnagenDiagnostic("meta-script-loaded"), { once: true });
      script.addEventListener("error", () => reportAnagenDiagnostic("meta-script-error"), { once: true });
      // Queue the event immediately while giving the critical product image a paint opportunity.
      const afterPaint = () => window.requestAnimationFrame(() => window.setTimeout(load, 0));
      const load = () => {
        window.clearTimeout(deadline);
        product.removeEventListener("load", afterPaint);
        product.removeEventListener("error", afterPaint);
        if (!script.isConnected) document.head.appendChild(script);
      };
      const deadline = window.setTimeout(load, 300);
      if (product.complete) afterPaint();
      else {
        product.addEventListener("load", afterPaint, { once: true });
        product.addEventListener("error", afterPaint, { once: true });
      }
    }
    window.dispatchEvent(new Event("renova-meta-ready"));
  }, []);

  return null;
}
