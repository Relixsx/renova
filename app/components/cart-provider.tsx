"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { formatNaira, type Product } from "../lib/catalog";

export type CartLine = {
  slug: string;
  name: string;
  imageUrl: string;
  priceKobo: number;
  variant: string;
  quantity: number;
  paymentMode: "prepaid" | "cash_on_delivery";
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotalKobo: number;
  add: (product: Product, variant?: string, quantity?: number) => void;
  update: (slug: string, variant: string, quantity: number) => void;
  remove: (slug: string, variant: string) => void;
  clear: () => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "renova-cart-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setLines((JSON.parse(stored) as CartLine[]).map((line) => ({ ...line, paymentMode: line.paymentMode ?? "prepaid" })));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, loaded]);

  const add = useCallback((product: Product, variant = product.variants[0] ?? "Standard", quantity = 1) => {
    setLines((current) => {
      const paymentMode = product.paymentMode ?? "prepaid";
      if (current.length && current.some((line) => line.paymentMode !== paymentMode)) {
        window.alert("Prepaid and payment-on-delivery products must be checked out separately. Please complete or clear your current bag first.");
        return current;
      }
      const found = current.find((line) => line.slug === product.slug && line.variant === variant);
      if (found) {
        return current.map((line) =>
          line.slug === product.slug && line.variant === variant
            ? { ...line, quantity: Math.min(10, line.quantity + quantity) }
            : line,
        );
      }
      return [...current, { slug: product.slug, name: product.name, imageUrl: product.imageUrl, priceKobo: product.priceKobo, variant, quantity, paymentMode }];
    });
    setCartOpen(true);
  }, []);

  const update = useCallback((slug: string, variant: string, quantity: number) => {
    if (quantity < 1) {
      setLines((current) => current.filter((line) => !(line.slug === slug && line.variant === variant)));
      return;
    }
    setLines((current) => current.map((line) => line.slug === slug && line.variant === variant ? { ...line, quantity } : line));
  }, []);

  const remove = useCallback((slug: string, variant: string) => {
    setLines((current) => current.filter((line) => !(line.slug === slug && line.variant === variant)));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setCartOpen(false);
  }, []);

  const value = useMemo(() => ({
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalKobo: lines.reduce((sum, line) => sum + line.priceKobo * line.quantity, 0),
    add,
    update,
    remove,
    clear,
    cartOpen,
    setCartOpen,
  }), [lines, add, update, remove, clear, cartOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}

export function CartDrawer() {
  const { lines, subtotalKobo, cartOpen, setCartOpen, update, remove } = useCart();
  return (
    <>
      <button className={`drawer-scrim ${cartOpen ? "is-open" : ""}`} aria-label="Close cart" onClick={() => setCartOpen(false)} />
      <aside className={`cart-drawer ${cartOpen ? "is-open" : ""}`} aria-hidden={!cartOpen}>
        <div className="drawer-head">
          <div><span className="eyebrow">Your selection</span><h2>Shopping bag</h2></div>
          <button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close cart">×</button>
        </div>
        <div className="drawer-lines">
          {lines.length === 0 ? (
            <div className="empty-state compact">
              <span className="empty-mark">R</span>
              <h3>Your bag is ready for something new.</h3>
              <Link href="/shop" onClick={() => setCartOpen(false)} className="text-link">Explore the collection</Link>
            </div>
          ) : lines.map((line) => (
            <article className="drawer-line" key={`${line.slug}-${line.variant}`}>
              <img src={line.imageUrl} alt="" />
              <div>
                <Link href={`/products/${line.slug}`} onClick={() => setCartOpen(false)}>{line.name}</Link>
                <span>{line.variant}</span>
                <strong>{formatNaira(line.priceKobo)}</strong>
                <div className="line-controls">
                  <button onClick={() => update(line.slug, line.variant, line.quantity - 1)} aria-label="Reduce quantity">−</button>
                  <span>{line.quantity}</span>
                  <button onClick={() => update(line.slug, line.variant, line.quantity + 1)} aria-label="Increase quantity">+</button>
                  <button className="remove-line" onClick={() => remove(line.slug, line.variant)}>Remove</button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {lines.length > 0 && (
          <div className="drawer-summary">
            <div><span>Subtotal</span><strong>{formatNaira(subtotalKobo)}</strong></div>
            <p>Delivery is calculated transparently at checkout.</p>
            <Link href="/checkout" className="button primary wide" onClick={() => setCartOpen(false)}>Continue to checkout</Link>
            <Link href="/cart" className="button quiet wide" onClick={() => setCartOpen(false)}>View full bag</Link>
          </div>
        )}
      </aside>
    </>
  );
}
