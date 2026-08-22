import { markOrderPaid, paystackSecret } from "../../../lib/order-payment";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = (process.env.APP_URL?.trim() || url.origin).replace(/\/$/, "");
  const reference = url.searchParams.get("reference") ?? "";
  const secret = paystackSecret();
  if (!reference || !secret) return Response.redirect(`${appUrl}/checkout?payment=configuration`, 303);
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { authorization: `Bearer ${secret}` } });
    const payload = await response.json() as { status?: boolean; data?: { status?: string; amount?: number; reference?: string } };
    if (!response.ok || !payload.status || payload.data?.status !== "success") return Response.redirect(`${appUrl}/checkout?payment=failed`, 303);
    await markOrderPaid(payload.data.reference ?? reference, Number(payload.data.amount ?? 0));
    return Response.redirect(`${appUrl}/order/success/${encodeURIComponent(reference)}`, 303);
  } catch (error) {
    console.error("Paystack callback verification failed", error);
    return Response.redirect(`${appUrl}/checkout?payment=verification`, 303);
  }
}
