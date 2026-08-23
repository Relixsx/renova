"use client";

import { useEffect } from "react";
import { useCart } from "./cart-provider";
import { onMetaPixelReady, trackMetaEvent } from "../lib/meta-pixel";

type PaidItem = { id: string; quantity: number; itemPrice: number };

export function PaidOrderCompletion({ orderNumber, total, items }: { orderNumber: string; total: number; items: PaidItem[] }) {
  const { clear } = useCart();

  useEffect(() => {
    clear();
    window.sessionStorage.setItem("renova-last-paid-order", orderNumber);
    const purchaseKey = `renova-meta-purchase-${orderNumber}`;
    return onMetaPixelReady(() => {
      if (window.localStorage.getItem(purchaseKey)) return;
      if (trackMetaEvent("Purchase", { contents: items.map((item) => ({ id: item.id, quantity: item.quantity, item_price: item.itemPrice })), content_ids: items.map((item) => item.id), content_type: "product", value: total, currency: "NGN", num_items: items.reduce((sum, item) => sum + item.quantity, 0), order_id: orderNumber }, orderNumber)) {
        window.localStorage.setItem(purchaseKey, "1");
      }
    });
  }, [clear, orderNumber, total, items]);

  return null;
}
