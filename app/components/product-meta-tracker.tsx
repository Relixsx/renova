"use client";

import { useEffect } from "react";
import { onMetaPixelReady, trackMetaEvent } from "../lib/meta-pixel";

export function ProductMetaTracker({ slug, name, value }: { slug: string; name: string; value: number }) {
  useEffect(() => onMetaPixelReady(() => {
    trackMetaEvent("ViewContent", {
      content_ids: [slug],
      content_name: name,
      content_type: "product",
      value,
      currency: "NGN",
    });
  }), [slug, name, value]);

  return null;
}
