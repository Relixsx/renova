# Renova cumulative source manifest

Snapshot date: 12 September 2026

This directory is the complete cumulative Renova source snapshot. It was
reconstructed from the last full V8 source package and every later verified
patch in chronological order.

## Source sequence

1. `Renova_Promo_Clean_Auto_Cycle_2026-08-28_v8.zip` — complete V8 source.
2. `Renova_Admin_Password_Recovery_Hang_Fix_v2.zip`.
3. `Renova_Password_Recovery_Cloudflare_Fix_v3.zip`.
4. `Renova_Neon_Login_Proxy_Fix_v4.zip`.
5. `Renova_Admin_Order_Date_Range_Excel_Export_2026-09-03.zip`.
6. `Renova_Customer_Reminder_Bot_2026-09-05.zip`.
7. `Renova_Reminder_Final_Arrival_Workflow_2026-09-06.zip`.
8. AI Product Assistant integration completed on 11 September 2026.
9. Routed admin workspace plus owner-controlled AI payment and promo settings
   completed on 12 September 2026.

The user-supplied archive named `6a295c83-7713-431d-8e1f-6c81b1a8a0f3.zip`
has SHA-256
`f0d77a68fabd518aed560e59a19eb01541c970797c06f6c3c4f6f706f3bad131`.
It is byte-for-byte identical to the 5 September customer-reminder patch. It
is not a complete Renova source archive and it predates the 6 September final
arrival-message workflow.

## Included working areas

- V8 storefront, catalogue, categories, product pages and responsive styling.
- Admin catalogue, product editing, reviews, image/video handling and AI image
  studio.
- Product promotion selection and automatic two-hour countdown cycling.
- Neon database and owner authentication, including password recovery and the
  login proxy correction.
- Paystack checkout, payment verification, orders, tracking and customer
  email flows.
- Date-range Excel order export.
- Customer reminder bot with scheduled email and WhatsApp delivery support.
- Cloudflare reminder cron worker.
- Manual final-arrival message workflow for pasted logistics updates.
- AI Product Assistant integrated into the existing Add Product form.
- Focused owner routes for overview, products, AI listing, categories, orders,
  reminders and reviews.

## AI Product Assistant boundaries

- Uses the existing owner authentication guard.
- Accepts and enforces one to three JPG, PNG or WebP images in the browser and
  backend.
- Uses the OpenAI Responses API from the backend only.
- Uses multimodal analysis, web research and strict JSON-schema output.
- Selects only existing Renova category identifiers.
- Flags uncertain facts and possible duplicate products.
- Preserves owner-entered prices and stock outside the AI request.
- Preserves the owner's Pay before delivery or Payment on delivery selection.
- Preserves the owner's promo on/off, wording and compare-at price selections.
- Populates the existing product form and existing image pipeline.
- Opens as an unpublished draft; it never saves or publishes automatically.
- Does not add a product table, database migration, category system, media
  system, inventory system or publishing path.

## Packaging exclusions

Environment files, credentials, `node_modules`, runtime caches and stale build
output are intentionally excluded. Existing `.env.local` and Render variables
remain in place when this package is unzipped over the project.

## Verification status

- Reminder and final-arrival patch archives passed ZIP integrity checks.
- The supplied reminder ZIP was matched byte-for-byte to its recovered copy.
- Relative source imports were checked across the application.
- `package.json` and `package-lock.json` dependency sets match.
- Server-side AI TypeScript files passed Node's TypeScript syntax check.
- The reminder cron worker passed JavaScript syntax validation.
- `npm run verify:cumulative` passed 30 cumulative-source checks, 20 AI
  integration safeguards and 35 admin routing/owner-control checks.

A production dependency build could not run in the packaging environment
because external npm dependency access was unavailable. Run `npm install` and
`npm run build` locally before pushing. This is required deployment
verification, not a database migration.
