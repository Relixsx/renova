# Regional delivery estimates

22 October 2026. This update replaces the previous blanket delivery estimate throughout the store:

- **Within Lagos: 3–5 working days.**
- **Outside Lagos: 3–12 working days.**

The window starts at order confirmation for payment on delivery, or verified payment for prepaid orders. It is the original delivery window, not a fresh countdown each time an update arrives. Keep any revised courier date accurate if an order is delayed.

## Apply the combined update

Download `renova-delivery-update-20261022.zip` and unzip it in Downloads. This version extracts to **renova-regional-delivery**. It includes the earlier delivery patch and the per-order WhatsApp controls; do not run an older extracted installer.

```bash
bash "$HOME/Downloads/renova-regional-delivery/apply-renova-regional-delivery.sh"
```

The installer locates `Documents/Renova_Store` and checks branch `migration/neon-render`. It accepts the confirmed checkout update, with or without either earlier delivery/WhatsApp-controls patch. It validates all affected files, requires a clean working tree, backs up replacements inside Git's metadata directory and rolls back an application failure. It does not push, deploy, connect to Neon or send messages.

If Git reports only the generated `tsconfig.tsbuildinfo`, you can restore that cache before retrying:

```bash
cd "$HOME/Documents/Renova_Store" &&
git status --short &&
git restore -- tsconfig.tsbuildinfo
```

Keep any other local edits before applying; do not discard them.

After installation, run:

```bash
cd "$HOME/Documents/Renova_Store" &&
npm run test:whatsapp &&
npx tsc --noEmit --incremental false &&
npm run verify:cumulative &&
git diff --check
```

Review `git diff`, then commit and push through your existing workflow:

```bash
git add -- app scripts/test-whatsapp.mjs tests DELIVERY_UPDATE.md REGIONAL_DELIVERY_UPDATE.md WHATSAPP_ORDER_CONTROLS.md WHATSAPP_SETUP.md &&
git commit -m "Use regional delivery estimates throughout Renova" &&
git push origin migration/neon-render
```

Wait for the new commit to show **Live** on the existing Render service. This ZIP does not change the live site until you apply and deploy it.

## What changes

General pages show both regions: the homepage, product pages, product FAQs, custom offer pages, delivery policy and shopping-assistant answers. Checkout shows the matching estimate as the delivery state changes, including carrier choices, review and the order summary. Carrier fees are retained. Kwik retains its existing Lagos-only description.

New orders store the matching estimate on the server. Confirmation/success pages, private order tracking, confirmation emails, daily email/SMS updates, WhatsApp confirmations and daily updates, admin previews and order exports use that order's delivery state.

Older orders with generic 3–5 or 3–7 working-day labels use the current regional estimate when displayed or sent. Saved product FAQs and custom landing-page delivery text are refreshed on read; no live bulk product rewrite is needed. Calendar dates and specific owner/courier estimates are preserved. If an older address has no recognizable state, both regional ranges are shown. The address state takes priority over any city or road that mentions Lagos.

The separate WhatsApp number, checkout disclosure, persisted cart reset, automatic new-order confirmations, per-order start/stop controls, customer STOP handling and full 24-hour interval are retained. Read `WHATSAPP_ORDER_CONTROLS.md` for historical-order enrollment and stopping updates.

No new database migration, package installation, Render setting, Worker update or Facebook template edit is required for this patch. The delivery estimate remains one of the four variables in the working `renova_delivery_update` template. Keep `WHATSAPP_TEMPLATE_LANGUAGE=en`.

## Verification

Local checks cover 62 regression tests, TypeScript, 86 existing source safeguards, a production build and rendered homepage, delivery-policy and product HTML. Tests exercise state selection, checkout storage, prepaid verification, confirmations, tracking, legacy estimates, product copy, previews and other notification channels. External providers are mocked; these checks do not send customer messages.

After Render shows Live, check a Lagos checkout and an outside-Lagos checkout. Confirm the matching estimate in review, then use a QA order and a WhatsApp number you control to check handset delivery. Preview a historical order under **Admin → Reminders → Delivery notes, message previews and other channels**. A delayed order can keep a specific revised courier date. Stop or cancel QA reminders after testing.
