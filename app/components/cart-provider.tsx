"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { formatNaira, type Product } from "../lib/catalog";
import { browserCartStorage, CART_STORAGE_KEY, completeCheckoutCart, createCartStore, rememberCheckoutCart, type CartLine } from "../lib/cart-storage";
export type { CartLine } from "../lib/cart-storage";

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotalKobo: number;
  add: (product: Product, variant?: string, quantity?: number) => void;
  update: (slug: string, variant: string, quantity: number) => void;
  remove: (slug: string, variant: string) => void;
  clear: () => void;
  rememberCheckout: (orderNumber: string, snapshot: CartLine[]) => void;
  completeCheckout: (orderNumber: string) => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
};
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const store = useMemo(() => createCartStore(), []);
  const lines = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY || event.key === null) store.refresh();
    };
    window.addEventListener("pageshow", store.refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pageshow", store.refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [store]);

  const commit = store.commit;

  const add = useCallback((product: Product, variant = product.variants[0] ?? "Standard", quantity = 1) => {
    const current = store.getSnapshot();
    const paymentMode = product.paymentMode ?? "prepaid";
    if (current.length && current.some((line) => line.paymentMode !== paymentMode)) {
      window.alert("Prepaid and payment-on-delivery products must be checked out separately. Please complete or clear your current bag first.");
      return;
    }
    const found = current.find((line) => line.slug === product.slug && line.variant === variant);
    commit(found
      ? current.map((line) => line.slug === product.slug && line.variant === variant ? { ...line, quantity: Math.min(10, line.quantity + quantity) } : line)
      : [...current, { slug: product.slug, name: product.name, imageUrl: product.imageUrl, priceKobo: product.priceKobo, variant, quantity, paymentMode }]);
    setCartOpen(true);
  }, [commit, store]);

  const update = useCallback((slug: string, variant: string, quantity: number) => {
    commit(quantity < 1
      ? store.getSnapshot().filter((line) => !(line.slug === slug && line.variant === variant))
      : store.getSnapshot().map((line) => line.slug === slug && line.variant === variant ? { ...line, quantity } : line));
  }, [commit, store]);

  const remove = useCallback((slug: string, variant: string) => {
    commit(store.getSnapshot().filter((line) => !(line.slug === slug && line.variant === variant)));
  }, [commit, store]);

  const clear = useCallback(() => { commit([]); setCartOpen(false); }, [commit]);
  const rememberCheckout = useCallback((orderNumber: string, snapshot: CartLine[]) => {
    rememberCheckoutCart(browserCartStorage(), orderNumber, snapshot);
  }, []);
  const completeCheckout = useCallback((orderNumber: string) => {
    if (completeCheckoutCart(browserCartStorage(), orderNumber)) {
      store.refresh(); setCartOpen(false);
    }
  }, [store]);

  const value = useMemo(() => ({
    lines, count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalKobo: lines.reduce((sum, line) => sum + line.priceKobo * line.quantity, 0),
    add, update, remove, clear, rememberCheckout, completeCheckout, cartOpen, setCartOpen,
  }), [lines, add, update, remove, clear, rememberCheckout, completeCheckout, cartOpen]);

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
