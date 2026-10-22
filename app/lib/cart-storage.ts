export type CartLine = {
  slug: string; name: string; imageUrl: string; priceKobo: number;
  variant: string; quantity: number; paymentMode: "prepaid" | "cash_on_delivery";
};
export type CartStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const CART_STORAGE_KEY = "renova-cart-v1";
const REVISION_KEY = "renova-cart-revision-v1";
const PENDING_PREFIX = "renova-checkout-cart-v1:";

export function browserCartStorage(): CartStorage | undefined {
  try { return window.localStorage; } catch { return undefined; }
}

export function readStoredCart(storage?: CartStorage): CartLine[] {
  try {
    const lines: CartLine[] = JSON.parse(storage?.getItem(CART_STORAGE_KEY) || "[]");
    if (!Array.isArray(lines)) return [];
    return lines.filter((line) => line && typeof line.slug === "string" && typeof line.variant === "string" && Number.isFinite(line.priceKobo) && Number.isFinite(line.quantity) && line.quantity > 0)
      .map((line) => ({ ...line, paymentMode: line.paymentMode ?? "prepaid" }));
  } catch { return []; }
}

function fingerprint(lines: CartLine[]) {
  return JSON.stringify(lines.map(({ slug, variant, quantity, priceKobo, paymentMode }) => ({ slug, variant, quantity, priceKobo, paymentMode })).sort((a, b) => a.slug.localeCompare(b.slug) || a.variant.localeCompare(b.variant)));
}

export function writeStoredCart(storage: CartStorage | undefined, lines: CartLine[]) {
  try {
    // Persist before navigation; React's next effect may never run on exit.
    storage?.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    storage?.setItem(REVISION_KEY, crypto.randomUUID());
  } catch { /* Shopping still works when browser storage is unavailable. */ }
}

export function rememberCheckoutCart(storage: CartStorage | undefined, orderNumber: string, lines: CartLine[]) {
  try {
    if (!storage || fingerprint(readStoredCart(storage)) !== fingerprint(lines)) return;
    if (!storage.getItem(REVISION_KEY)) storage.setItem(REVISION_KEY, crypto.randomUUID());
    storage.setItem(`${PENDING_PREFIX}${orderNumber}`, JSON.stringify({ revision: storage.getItem(REVISION_KEY), fingerprint: fingerprint(lines) }));
  } catch { /* No saved cart can be cleared when storage is unavailable. */ }
}

// Call only from a server-verified paid-order success view. Consuming the marker
// once prevents an old success URL/reload from deleting a later shopping bag.
export function completeCheckoutCart(storage: CartStorage | undefined, orderNumber: string) {
  try {
    if (!storage) return false;
    const key = `${PENDING_PREFIX}${orderNumber}`;
    const marker = JSON.parse(storage.getItem(key) || "null");
    storage.removeItem(key);
    if (!marker || marker.revision !== storage.getItem(REVISION_KEY) || marker.fingerprint !== fingerprint(readStoredCart(storage))) return false;
    writeStoredCart(storage, []);
    return true;
  } catch { return false; }
}

export const EMPTY_CART: CartLine[] = [];

// React subscribes to this browser store instead of saving state in a delayed
// effect. Cached snapshots also keep hydration and cross-tab updates stable.
export function createCartStore(storage: () => CartStorage | undefined = browserCartStorage) {
  let lines: CartLine[] = EMPTY_CART;
  let previousRaw: string | null | undefined;
  const listeners = new Set<() => void>();
  const raw = () => { try { return storage()?.getItem(CART_STORAGE_KEY); } catch { return undefined; } };
  const refresh = () => listeners.forEach((listener) => listener());
  return {
    getSnapshot() {
      const current = raw();
      if (current !== previousRaw) { previousRaw = current; lines = readStoredCart(storage()); }
      return lines;
    },
    getServerSnapshot: () => EMPTY_CART,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    commit(next: CartLine[]) {
      writeStoredCart(storage(), next);
      previousRaw = raw();
      lines = next;
      refresh();
    },
    refresh,
  };
}
