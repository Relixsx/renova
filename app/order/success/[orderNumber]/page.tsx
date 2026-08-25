import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { PaidOrderCompletion } from "../../../components/paid-order-completion";
import { OrderMotionVisual } from "../../../components/order-motion-visual";
import { formatNaira } from "../../../lib/catalog";
export const dynamic = "force-dynamic";
export default async function SuccessPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const [order] = await getDb().select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  const paid = order?.paymentStatus === "paid";
  const deliveryPayment = order?.paymentMethod === "cash_on_delivery";
  const confirmed = paid || deliveryPayment;
  const paidItems = order ? (JSON.parse(order.itemsJson || "[]") as Array<{ slug?: string; sku?: string; quantity?: number; unitPriceKobo?: number }>).map((item) => ({ id: item.slug || item.sku || "product", quantity: item.quantity || 1, itemPrice: (item.unitPriceKobo || 0) / 100 })) : [];

  return <main className="order-result order-result-signature">
    {paid && order && <PaidOrderCompletion orderNumber={orderNumber} total={order.totalKobo / 100} items={paidItems}/>} 
    <OrderMotionVisual />
    <span className="eyebrow">{deliveryPayment ? "Order confirmed" : paid ? "Payment verified" : "Payment status"}</span>
    <h1>{confirmed ? <>Thank you.<br/><em>Your order is in motion.</em></> : "We are confirming your payment."}</h1>
    {order ? <>
      <p>Order <b>{order.orderNumber}</b> · {formatNaira(order.totalKobo)}. {confirmed ? deliveryPayment ? "Your order is confirmed for payment on delivery, tracking is active, and your shopping bag has been cleared." : "Your confirmation is being sent, tracking is active, and your shopping bag has been cleared." : "Please do not pay twice; refresh after a moment if Paystack has completed your payment."}</p>
      <div className="success-facts"><span>Order status <b>{order.status.replaceAll("_", " ")}</b></span><span>Estimated delivery <b>{order.estimatedDelivery ?? "3–5 working days"}</b></span></div>
    </> : <p>We could not find this order reference. Please email support if payment was deducted.</p>}
    <div className="success-actions"><Link href="/track-order" className="button primary">Track this order</Link><Link href="/shop" className="button quiet">Continue shopping</Link></div>
    <small>{deliveryPayment ? "This payment-on-delivery order is recorded securely by Renova." : "Payment status is shown only from Renova’s server-verified order record."}</small>
  </main>;
}
