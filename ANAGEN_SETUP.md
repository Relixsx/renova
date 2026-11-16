# Anagen on Renova

Public page after deployment: **https://shoprenova.com.ng/anagen**.

This update adapts the supplied Anagen page to the existing Renova app. It keeps
the green/teal product design, supplier images, bundle
prices, free doorstep delivery and payment on delivery. Customers order on the
page itself. The supplied 14-day result wording and testimonials are identified
as supplier material; they are not new Renova verified-purchase reviews.

## Install with the Aiven migration

This page is included in the combined `renova-aiven-update-20261116.zip`.
Follow **AIVEN_MIGRATION.md** in order. Its local installer accepts the earlier
pending Anagen update, and the final preparation tool sets up the product in
the final Aiven store after making the fresh copy. Do not run the older
Anagen-only installer or switch Render to the initial staging database.

Product setup uses the actual available pack count that you enter privately.
It is additive and idempotent: an existing Anagen product, stock and owner edits
are preserved. No existing store schema migration is reapplied. The combined
update has new database and owner-login settings documented in AIVEN_MIGRATION.md.

## How the order form works

| Package | Contents | Total due on delivery |
| --- | --- | --- |
| 1 pack | 2 sachets and application guide | ₦11,200 |
| 2 packs | 4 sachets and application guide | ₦20,400 |
| 3 packs | 6 sachets and application guide | ₦28,600 |

- Prices and the zero delivery charge are calculated on the server. Form
  submissions cannot change the price or order a different product.
- Full name, delivery phone, **separate WhatsApp number**, address, state,
  city/town and Today/Tomorrow availability are required. Email, alternative
  phone and LGA are optional. The customer confirms the COD commitment and sees
  the WhatsApp order-update notice.
- The order is saved in the existing Renova `orders` table, with the normal
  order number, admin visibility, payment-due status, email notification and
  WhatsApp queue. It is not saved in a separate CSV.
- The owner alert uses the existing **FORMSPREE_ENDPOINT**, including the bundle,
  exact amount, delivery phone, WhatsApp number, alternative phone, address and
  availability. Customer confirmation email uses the existing Resend settings
  when the customer supplies an email. Blank email is kept blank.
- The WhatsApp confirmation and daily updates use the existing integration,
  consent records, approved template and full 24-hour interval. Existing stop,
  arrival and collection controls still apply.
- A three-pack offer is stored as **one 3-pack bundle**, priced at exactly
  ₦28,600, so item calculations never introduce fractional kobo. Admin/email
  item names show the actual pack count.
- Current catalogue availability is checked in **packs** at submission, using
  the store's existing stock workflow. Set and maintain available stock in
  Admin → Products. An unlisted/draft/unavailable product or mismatched base
  price cannot accept orders through the form.
- Anagen uses its own free doorstep delivery and **1–2 working day** estimate.
  Same-day state-capital delivery is the supplied offer; the team confirms the
  actual delivery time. The Today/Tomorrow field records availability and is
  not an automatically guaranteed appointment. Other products retain the
  existing Lagos/outside-Lagos policy.
- Shop cards and existing `/products/anagen` or `/offers/anagen` URLs lead to
  `/anagen`. Its product-specific offer is not routed through the generic bag
  checkout. Orders from this form leave an unrelated existing shopping bag
  untouched.
- A failed network request retains the customer's entries and retry reference.
  Repeat/concurrent submits create one order and one notification set. After a
  confirmed success, the form resets and shows the reference and tracking link.
- Customers who omit email can track with their order number **and delivery
  phone**. Phone lookup applies only to Anagen orders placed without email.
  Existing email-based tracking is preserved.

If a notification provider is unavailable, the order remains in Admin. Check
Render logs and the existing reminder delivery controls; provider acceptance
and arrival on a handset are different checks. The integration tests mock
providers and do not send a real message.

## Existing settings and supplier files

The page inherits Renova's Meta Pixel loader. It uses the configured
`NEXT_PUBLIC_WHATSAPP_NUMBER` for support, falling back to Renova support email
when that number is absent. The friend's Pixel, contact details, SMTP password,
separate PHP admin, CSV storage and PHPMailer code are not installed.
The two MP4 files in the supplied archive advertise car-scratch removal; they
are unrelated to Anagen and are excluded from this update.

The marketing page and local media do not poll the database. Product validation and
order writes happen when the form is submitted. This update does not change
the existing reminder Worker's cron interval.

Bundle definitions live in `app/lib/anagen-offer.mjs`, shared by the page,
order endpoint and setup script. Changing Anagen's base price only in Admin
pauses form ordering until the shared advertised offer is updated to match.

## Verification

The supplied source passed the WhatsApp/integration suite, TypeScript,
cumulative safeguards, a production build and rendered-page tests. Local React
interaction checks cover package selection, state/LGA choices, optional email,
separate WhatsApp, duplicate clicks, failed-network retention, stable retries,
success/reset and unrelated-cart preservation.

A hosted browser preview was blocked by automatic approval review because it
could transmit private Renova source to Cloudflare. No hosted preview was
used; local rendering and React interaction checks were completed instead.

## Live check after deployment

With an opted-in test recipient and real available stock, submit one test order
from `/anagen`. Confirm its exact pack price and free delivery in Admin, the
owner email in your inbox, and the confirmation on the recipient WhatsApp.
Use the existing admin controls to stop/cancel the test order afterward.
Automatic messages use the active integration and its existing limits.
