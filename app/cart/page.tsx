"use client";

import Link from "next/link";
import { StoreFrame } from "../components/storefront";
import { useCart } from "../components/cart-provider";
import { formatNaira } from "../lib/catalog";

export default function CartPage() {
  const { lines, subtotalKobo, update, remove } = useCart();
  return <StoreFrame><section className="page-hero small"><span className="eyebrow">Your selection</span><h1>Shopping bag.</h1><p>Review products, variants and quantities before checkout.</p></section><section className="cart-page">{lines.length === 0 ? <div className="empty-state catalogue-empty"><span className="empty-mark">R</span><h2>Your bag is empty.</h2><p>Explore the catalogue and add something useful.</p><Link href="/shop" className="button primary">Shop all products</Link></div> : <><div className="cart-page-lines">{lines.map((line) => <article key={`${line.slug}-${line.variant}`}><img src={line.imageUrl} alt=""/><div><span className="product-category">{line.variant}</span><Link href={`/products/${line.slug}`}><h2>{line.name}</h2></Link><button className="remove-link" onClick={() => remove(line.slug, line.variant)}>Remove</button></div><div className="cart-page-quantity"><button onClick={() => update(line.slug, line.variant, line.quantity - 1)}>−</button><span>{line.quantity}</span><button onClick={() => update(line.slug, line.variant, line.quantity + 1)}>+</button></div><strong>{formatNaira(line.priceKobo * line.quantity)}</strong></article>)}</div><aside className="cart-totals"><span className="eyebrow">Order summary</span><div><span>Subtotal</span><b>{formatNaira(subtotalKobo)}</b></div><div><span>Delivery</span><b>Calculated next</b></div><p>Prices are revalidated securely before Paystack is initialised.</p><Link href="/checkout" className="button primary wide">Continue to checkout</Link><Link href="/shop" className="button quiet wide">Keep shopping</Link></aside></>}</section></StoreFrame>;
}
