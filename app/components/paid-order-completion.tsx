"use client";

import { useEffect } from "react";
import { useCart } from "./cart-provider";

export function PaidOrderCompletion({ orderNumber }: { orderNumber: string }) {
  const { clear } = useCart();

  useEffect(() => {
    clear();
    window.sessionStorage.setItem("renova-last-paid-order", orderNumber);
  }, [clear, orderNumber]);

  return null;
}
