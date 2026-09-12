# Renova Admin Workspace Update

This update reorganizes the existing owner console into focused routes. It does
not add a second admin, product model, database, inventory system or publishing
pipeline.

## Admin routes

- `/admin` — overview and store metrics
- `/admin/products` — product search, editing, preview and publishing
- `/admin/ai-listing` — AI Product Assistant
- `/admin/categories` — category-based product entry
- `/admin/orders` — order status and date-range Excel export
- `/admin/reminders` — customer delivery reminders
- `/admin/reviews` — product review management

All routes pass through the existing Neon owner-authentication check and render
the same shared `AdminCatalogue` component. The desktop sidebar and mobile
sticky navigation use real links, so one admin function is displayed at a time.

## AI listing owner controls

The AI Product Assistant accepts exactly one to three JPG, PNG or WebP images.
Before generating a listing, the owner explicitly selects:

- Pay before delivery (the existing secure Paystack checkout)
- Payment on delivery (the existing COD checkout)
- Promo off or on
- Optional promo wording
- Optional original / compare-at price

These choices are never made by AI. They are transferred into the existing Add
Product form together with the generated draft. A promo uses Renova's existing
recurring two-hour timer and continues until the owner switches it off.

## Safety boundaries

- No database schema or migration changes
- No checkout, Paystack or order API changes
- No reminder scheduling or provider changes
- No storefront or public product-page changes
- No automatic product publication
- No direct product write from the AI endpoint
- Existing media upload and image optimization remain in use

## Required local checks

```bash
npm install
npm run verify:cumulative
npm run build
npm run dev
```

Check every admin route, both payment choices, promo on/off, one image, three
images, the normal manual product flow, order status changes, export, reminders
and reviews before pushing the update to the live branch.
