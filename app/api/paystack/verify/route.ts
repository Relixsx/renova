import { markOrderPaid, paystackSecret } from "../../../lib/order-payment";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") ?? "";
  const secret = paystackSecret();
  if (!reference || !secret) return Response.redirect(`${url.origin}/checkout?payment=configuration`, 303);
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { authorization: `Bearer ${secret}` } });
    const payload = await response.json() as { status?: boolean; data?: { status?: string; amount?: number; reference?: string } };
    if (!response.ok || !payload.status || payload.data?.status !== "success") return Response.redirect(`${url.origin}/checkout?payment=failed`, 303);
    await markOrderPaid(payload.data.reference ?? reference, Number(payload.data.amount ?? 0));
    return Response.redirect(`${url.origin}/order/success/${encodeURIComponent(reference)}`, 303);
  } catch {
    return Response.redirect(`${url.origin}/checkout?payment=verification`, 303);
  }
}
