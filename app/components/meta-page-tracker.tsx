"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function MetaPageTracker() {
  const pathname = usePathname();
  const firstPath = useRef(true);

  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  return null;
}
