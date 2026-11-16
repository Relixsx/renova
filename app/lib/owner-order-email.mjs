// Owner order alerts use the existing HTTPS mail connection. They do not use
// a browser form service, a customer's recipient field, or SMTP credentials.
export const OWNER_ORDER_EMAIL = 'airebirth5@gmail.com';
const endpoint = 'https://api.resend.com/emails';
const clean = value => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[char]);
const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value);
function parsed(value, array = false) {
  try {
    const result = JSON.parse(value || (array ? '[]' : '{}'));
    if (array) return Array.isArray(result) ? result.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
    return result && typeof result === 'object' && !Array.isArray(result) ? result : {};
  } catch { return array ? [] : {}; }
}

export function ownerOrderEmailStatus(env = process.env) {
  const from = (env.RESEND_FROM_EMAIL?.trim() || env.ORDER_FROM_EMAIL?.trim() || '');
  return { recipient: OWNER_ORDER_EMAIL, configured: Boolean(env.RESEND_API_KEY?.trim() && from && !/[\r\n]/.test(from)) };
}

export function buildOwnerOrderEmail(order, env = process.env) {
  const cod = order.paymentMethod === 'cash_on_delivery' && order.paymentStatus === 'payment_due_on_delivery';
  const paid = order.paymentMethod === 'paystack' && order.paymentStatus === 'paid';
  if (!cod && !paid) return null;
  if (!Number.isSafeInteger(order.totalKobo) || order.totalKobo < 0) throw new Error('The saved order amount is invalid.');
  const from = (env.RESEND_FROM_EMAIL?.trim() || env.ORDER_FROM_EMAIL?.trim() || '');
  if (!from || /[\r\n]/.test(from)) throw new Error('RESEND_FROM_EMAIL is required for owner order alerts.');
  const items = parsed(order.itemsJson, true), address = parsed(order.addressJson);
  const productSummary = items.map((item, index) => {
    const variant = item.variant && item.variant !== 'Standard' ? ` (${clean(item.variant)})` : '';
    return `${index + 1}. ${clean(item.name) || 'Product'}${variant} — Quantity: ${Number(item.quantity) || 1}${Number.isInteger(item.packQuantity) ? `; packs: ${item.packQuantity}` : ''}`;
  }).join('\n') || 'See the saved order in Admin';
  const deliveryAddress = [address.streetAddress, address.cityTown ?? address.town, address.lga ?? address.localGovernment, address.state ?? address.stateCode].filter(Boolean).map(clean).join(', ');
  const amount = `₦${(order.totalKobo / 100).toLocaleString('en-NG', {maximumFractionDigits:2})}`;
  const rows = [
    ['Order Number', order.orderNumber],
    ['Tracking Number', order.trackingNumber || order.orderNumber],
    ['Payment Status', cod ? 'Payment due on delivery' : 'Paid via Paystack'],
    [cod ? 'Amount Due' : 'Amount Paid', amount],
    ['Customer Name', order.customerName],
    ['Customer Email', order.customerEmail || 'Not provided'],
    ['Phone Number', order.customerPhone],
    ['WhatsApp Number', order.whatsappPhone || 'Not provided'],
    ['Alternative Phone', address.alternativePhone || 'Not provided'],
    ['Available to Receive', address.availabilityDay || 'Not specified'],
    ['Product and Quantity', productSummary],
    ['Delivery Address', deliveryAddress || 'See the saved order in Admin'],
    ['Delivery Estimate', order.estimatedDelivery || 'See the saved order in Admin'],
    ['Order Time', order.createdAt || 'See the saved order in Admin'],
  ];
  const subject = `${cod ? 'New payment-on-delivery' : 'New paid'} Renova order — ${clean(order.orderNumber)}`;
  const text = [subject, '', ...rows.map(([name,value]) => `${name}: ${clean(value)}`), '', 'View and manage this order in Renova Admin.'].join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#faf7f2;font-family:Arial,Helvetica,sans-serif;color:#25160f"><main style="max-width:720px;margin:auto;background:white;padding:28px;border-top:4px solid #ff5a2f"><p style="letter-spacing:3px;font-weight:bold">RENOVA</p><h1 style="font-size:24px">New order received</h1><p>The order is saved in your Renova admin.</p><table style="width:100%;border-collapse:collapse">${rows.map(([name,value]) => `<tr><th align="left" valign="top" style="padding:12px;border-bottom:1px solid #eee">${escape(name)}</th><td style="padding:12px;border-bottom:1px solid #eee;white-space:pre-line">${escape(value)}</td></tr>`).join('')}</table></main></body></html>`;
  return { from, to:[OWNER_ORDER_EMAIL], subject, text, html, ...(validEmail(order.customerEmail) ? {reply_to:order.customerEmail} : {}) };
}

export async function sendOwnerOrderEmail(order, {env = process.env, fetcher = globalThis.fetch} = {}) {
  const message = buildOwnerOrderEmail(order, env);
  if (!message) return false;
  const key = env.RESEND_API_KEY?.trim();
  if (!key) throw new Error('RESEND_API_KEY is required for owner order alerts.');
  const idempotencyKey = `renova-owner-order-${clean(order.orderNumber)}`;
  if (idempotencyKey.length > 256) throw new Error('The saved order reference is too long for an owner alert.');
  let response;
  try {
    response = await fetcher(endpoint, {method:'POST', redirect:'error', headers:{authorization:`Bearer ${key}`,'content-type':'application/json','Idempotency-Key':idempotencyKey}, body:JSON.stringify(message), signal:AbortSignal.timeout(15000)});
  } catch { throw new Error('The owner order email connection did not complete. The order remains saved in Admin.'); }
  // Never log an API response body, an API key, or the customer's submitted data.
  if (!response.ok) throw new Error(`Owner order email was not accepted (HTTP ${response.status}). The order remains saved in Admin.`);
  const result = await response.json().catch(() => null);
  if (!result || typeof result.id !== 'string' || !result.id) throw new Error('The owner email provider returned an invalid receipt. The order remains saved in Admin.');
  return true;
}
