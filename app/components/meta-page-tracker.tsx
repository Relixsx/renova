"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function MetaPageTracker() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (!pathname || pathname === previousPath.current) return;
    previousPath.current = pathname;
    window.fbq?.("track", "PageView");
  }, [pathname]);

  return null;
}
