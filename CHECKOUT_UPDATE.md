# Renova checkout and WhatsApp update

Current checkout wording: the WhatsApp number hint, final review and COD confirmation explain automatic order updates without printed STOP instructions. The oversized green block is replaced by a compact order-updates section beside the order action. See `FULL_REMINDER_MESSAGE_EDITOR.md` for the current combined ZIP and install command.

22 October 2026. Incremental update for `Relixsx/renova`, branch `migration/neon-render`, deployed integration commit `123e4e4`.

## What changes

- Checkout has separate required email, delivery phone and WhatsApp phone fields. The WhatsApp number can differ from the courier number.
- The optional WhatsApp checkbox is removed. The contact-field explanation, existing data-use agreement and notice beside the order button explain that placing the order requests confirmation and daily WhatsApp updates. The order records the supplied WhatsApp number, timestamp and `checkout-v3` notice version. In-progress v2 checkout pages and earlier consent records remain supported.
- Payment-on-delivery orders send confirmation automatically after the order is saved. Prepaid orders wait for server-verified payment. Existing consented orders continue working; historical orders without agreement are not enrolled.
- The cart is saved as empty synchronously before successful COD navigation, so refresh, cart reopening and returning to checkout show zero. The completed COD form is reset. Failed orders keep the cart.
- Paystack initialization keeps the bag. Returning to a server-verified paid order clears the matching checkout bag once. Reloading an old success link cannot erase a later cart. A bag edited after payment initialization is preserved.
- Confirmation thanks the customer and says the order has been received and is being processed. Both messages include item quantities, payment details and the recorded delivery estimate. Daily wording reflects confirmed, processing, packaged or dispatched status; only dispatched orders say they are on the way. Courier details come from your verified admin notes.
- Admin → Reminders shows delivery and WhatsApp numbers separately, preserves the chosen recipient when saving, and previews the initial confirmation and next daily message separately.

## Install on your Mac

1. Unzip `renova-checkout-update-20261022.zip` in Downloads. The resulting folder is `renova-checkout-update`.
2. Run:

   ```bash
   bash "$HOME/Downloads/renova-checkout-update/apply-renova-checkout.sh"
   ```

   The installer detects `$HOME/Documents/Renova_Store`. If necessary, pass the existing repository explicitly:

   ```bash
   bash "$HOME/Downloads/renova-checkout-update/apply-renova-checkout.sh" "$HOME/Documents/Renova_Store"
   ```

   It verifies the branch, source commit, clean working tree and before/after file checksums. It backs up replaced files inside Git's metadata directory and rolls back a failed application. Unexpected edits cause it to stop before changing files. It never initializes a repository, changes branches, installs packages, contacts a database or pushes code.

3. Run the checks:

   ```bash
   cd "$HOME/Documents/Renova_Store"
   npm ci --legacy-peer-deps
   npm run test:whatsapp
   npx tsc --noEmit
   npm run verify:cumulative
   git diff --check
   git diff --stat
   ```

4. Review `git diff`, then commit and push when ready:

   ```bash
   git add -- app scripts/test-whatsapp.mjs tests CHECKOUT_UPDATE.md WHATSAPP_SETUP.md REMINDER_BOT_SETUP.md
   git commit -m "Automate WhatsApp checkout updates and reset completed carts"
   git push origin migration/neon-render
   ```

5. Wait for the existing Render service to show the new commit as Live.

**No new database migration is needed.** The separate WhatsApp number and consent fields already exist from `0006_whatsapp_order_updates`. Keep the current working Render credentials, `WHATSAPP_TEMPLATE_LANGUAGE=en`, template `renova_delivery_update` and Cloudflare schedule. There is no Worker code change in this package.

## Message format

Both kinds use your existing approved four-variable Meta template. Its greeting, “latest update” introduction, expected-delivery label and footer remain fixed; the order-specific paragraph is improved. No new template approval is required for this code to use the same approved template.

Example confirmation paragraph, using illustrative order data:

> Thank you for choosing Renova! Your order has been received and is being processed. Items: 1 × Wireless headphones. ₦24,500 is due when you receive your order. Reply STOP to stop WhatsApp updates.

Example daily paragraph after **Dispatched**:

> Your daily delivery update: Your order has been dispatched and is on the way. Please be ready to receive your parcel. Items: 1 × Wireless headphones. ₦24,500 is due when you receive your order. Reply STOP to stop WhatsApp updates.

Actual names, order reference, items, amount and delivery estimate come from that customer's order. Large orders use a shortened item summary. Payment received replaces the amount-due wording for paid orders. No test order ID or test-only text is sent by production checkout.

## Test after Render is Live

1. Use two different numbers you control: one in delivery phone and one in WhatsApp phone. Place one small COD QA order after reviewing the visible messaging notice.
2. Check that its confirmation reaches the **WhatsApp number**, with the correct items and amount. Open cart, refresh and return to checkout: the bag should be empty and totals zero.
3. In Admin → Reminders, confirm both numbers. Select **Preview confirmation & daily update**, save a truthful note with **Save for next update**, and confirm that saving alone sends nothing and preserves the WhatsApp recipient.
4. Confirmed/processing/packaged previews must not claim dispatch. Mark dispatched only when courier handover really happens. Do not dispatch the QA order.
5. Confirm the daily message after at least 24 hours, with the latest order details. The five-minute Worker checks for due work; it does not send customers every five minutes.
6. Reply **STOP** from that WhatsApp phone and confirm Admin shows WhatsApp disabled. Cancel the QA order after checking, and cancel the earlier duplicate QA orders if still active. Use delivered/collected only for actual completed deliveries.

API acceptance and local tests do not prove handset delivery or a working live STOP webhook. Check the phone and delivery receipts. Keep your existing reminder failure/retry controls; uncertain sends still require checking Meta before retrying.

## Validation

Prepared checks: TypeScript, the production build, the rendered-home-page test, 41 checkout/WhatsApp regression tests and 86 cumulative/AI/admin safeguards. The changed checkout/cart/WhatsApp files have no lint errors. Repository-wide lint has existing effect-hook errors in the unchanged login, reset-password, cookie-consent, shopper-tools and storefront components. A visual browser run was unavailable in the preparation environment; complete the live checks above after deployment.

The package includes local regression tests for checkout recipient separation, v1/v2 consent compatibility, automatic COD confirmation, verified prepaid confirmation, admin recipient preservation, cart persistence, failed/abandoned payment retention, old success visits, the 24-hour interval, duplicate protection, STOP and delivery receipts. Provider calls are mocked and PostgreSQL runs locally through PGlite. Local preparation does not change live Neon, Render, GitHub, Meta or Cloudflare.

Copy is original Renova wording, informed by Amazon's [order-confirmation guidance](https://www.amazon.com/gp/help/customer/display.html?nodeId=201633550). The disclosure and STOP flow follow the consent and opt-out principles in the [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/).
