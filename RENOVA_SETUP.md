# Renova production setup

## Owner dashboard

Open `/admin` and sign in with an authorised owner email. The current owner allowlist contains:

- `relixsx@gmail.com`
- `airebirth5@gmail.com`

The dashboard supports category-based product creation, product editing, current and previous pricing, stock, variants, supplier-only data, cover images, gallery images, MP4/WebM product videos and review management.

## Required environment variables

Never commit live keys to GitHub. Add these values in the hosting provider's environment-variable settings or in a local `.env` file that remains ignored by Git.

```text
PAYSTACK_SECRET_KEY=sk_live_...
FORMSPREE_ENDPOINT=https://formspree.io/f/your_form_id
```

Renova uses Paystack's server-side transaction initialisation, so the secret key is sufficient for the current redirect checkout. The browser never receives the secret key.

## Paystack webhook

After connecting the production domain, add this webhook URL in the Paystack dashboard:

```text
https://YOUR_DOMAIN/api/paystack/webhook
```

The webhook validates `x-paystack-signature` with HMAC-SHA512 before marking an order paid. The return callback also verifies the transaction directly with Paystack. A payment button click alone never marks an order paid.

## Formspree notification

Create a Formspree form that delivers to `airebirth5@gmail.com`, then use its endpoint as `FORMSPREE_ENDPOINT`. After a payment is verified, Renova sends the order number, paid amount, customer details, ordered items, delivery address and courier selection to that endpoint.

## Media storage

Product media uses the configured R2 `BUCKET` binding. Images may be up to 15 MB each. MP4 and WebM videos may be up to 50 MB each. A cover image remains required for product cards; videos can appear in the product-page media gallery.
