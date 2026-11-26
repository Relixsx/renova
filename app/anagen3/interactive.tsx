"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AnagenBundleLink, AnagenOrderForm } from "../components/anagen-order-form";
import { ANAGEN } from "../lib/anagen-offer.mjs";
import type { AnagenState } from "../lib/anagen-states";
import { reportAnagenDiagnostic } from "../lib/anagen-diagnostics";
import { onMetaPixelReady } from "../lib/meta-pixel";
import { trackAnagen3, trackAnagen3Meta } from "../lib/anagen3-analytics";
import styles from "./anagen3.module.css";

type Bundle = typeof ANAGEN.bundles[number];
const StockContext = createContext<number | null | undefined>(undefined);
const money = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

export function Anagen3Stock({ children }: { children: ReactNode }) {
  const [stock, setStock] = useState<number | null>();
  useEffect(() => {
    const controller = typeof AbortController === "function" ? new AbortController() : undefined;
    let active = true;
    fetch("/api/anagen/availability", { signal: controller?.signal, priority: "low" }).then(async (response) => {
      if (!active) return;
      if (!response.ok) { reportAnagenDiagnostic("availability-error"); return; }
      const { capacity } = await response.json();
      if (active && (capacity === null || (Number.isInteger(capacity) && capacity >= 0 && capacity <= ANAGEN.bundles.length))) {
        setStock(capacity);
      }
    }).catch(() => {
      if (active) reportAnagenDiagnostic("availability-error");
    });
    return () => { active = false; controller?.abort(); };
  }, []);
  return <StockContext.Provider value={stock}>{children}</StockContext.Provider>;
}

export function Anagen3BundleButton({ bundle, primary = false }: { bundle: Bundle; primary?: boolean }) {
  const stock = useContext(StockContext);
  if (stock === null || (typeof stock === "number" && stock < bundle.packs)) {
    return <button type="button" className={styles.bundleButton} disabled>Currently unavailable</button>;
  }
  return <AnagenBundleLink packs={bundle.packs} funnel="anagen3" className={`${styles.bundleButton} ${primary ? styles.primaryBundle : ""}`} ariaLabel={`Select this package, ${bundle.label} for ${money(bundle.totalKobo)}`}>
    Select this package <span aria-hidden="true">↗</span>
  </AnagenBundleLink>;
}

export function Anagen3Checkout({ supportPhone, states }: { supportPhone: string; states: AnagenState[] }) {
  const stock = useContext(StockContext);
  return <AnagenOrderForm stock={stock} supportPhone={supportPhone} states={states} funnel="anagen3" />;
}

export function Anagen3StickyOrder() {
  const [visible, setVisible] = useState(false);
  const stock = useContext(StockContext);

  useEffect(() => {
    let viewed = false;
    const stopPixel = onMetaPixelReady(() => {
      if (!viewed) viewed = trackAnagen3Meta("ViewContent", 1, ANAGEN.bundles[0].totalKobo);
    });
    const cta = document.getElementById("anagen3-primary");
    const section = document.getElementById("order-form");
    if (!cta || !section || typeof IntersectionObserver === "undefined") return stopPixel;
    const hero = cta;
    const form = section;

    let reached = false;
    let tracked = false;
    function trackForm() {
      if (reached && !tracked && window.fbq) {
        trackAnagen3("AnagenOrderFormReached", {}, true);
        tracked = true;
      }
    }
    const stopFormPixel = onMetaPixelReady(trackForm);
    const observer = new IntersectionObserver(() => {
      const bounds = form.getBoundingClientRect();
      const formVisible = bounds.top < window.innerHeight && bounds.bottom > 0;
      if (formVisible) {
        reached = true;
        trackForm();
      }
      setVisible(hero.getBoundingClientRect().bottom <= 0 && bounds.top >= window.innerHeight);
    });
    observer.observe(hero);
    observer.observe(form);
    return () => {
      stopPixel();
      stopFormPixel();
      observer.disconnect();
    };
  }, []);

  if (!visible || stock === null || stock === 0) return null;
  return <div className={styles.stickyBar}>
    <a href="#order-form" className={styles.button}>Order now — from {money(ANAGEN.bundles[0].totalKobo)} <span aria-hidden="true">↗</span></a>
  </div>;
}
