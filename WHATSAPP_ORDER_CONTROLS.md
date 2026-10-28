# Per-order WhatsApp notifications

Latest 27 October follow-up: use [SIMPLE_DELIVERY_REMINDERS.md](./SIMPLE_DELIVERY_REMINDERS.md). Enter the Jumia dates and save; the complete customer message is prepared and previewed automatically. Optional wording changes are collapsed. This follow-up uses the installed migration 0007 and needs no new migration.

Latest 26 October combined update: see [JUMIA_DELIVERY_COUNTDOWN.md](./JUMIA_DELIVERY_COUNTDOWN.md) for per-order Jumia date ranges and daily countdowns. [REMINDER_MESSAGE_EDITOR.md](./REMINDER_MESSAGE_EDITOR.md) covers separate editable daily/arrival messages, previews and the one combined migration 0007. It replaces the uninstalled 23 October editor download. Use its installation steps for this update; the 22 October instructions below document the earlier patch.

22 October 2026. This combined package includes the regional delivery estimates (3–5 working days within Lagos, 3–12 working days outside Lagos) and controls for new and historical orders. See REGIONAL_DELIVERY_UPDATE.md for the current delivery update. The installer accepts the confirmed checkout update with either earlier patch applied or neither.

## Apply and deploy

1. Download the updated `renova-delivery-update-20261022.zip` and unzip it in Downloads. This updated version extracts a **renova-regional-delivery** folder.
2. Run:

   ```bash
   bash "$HOME/Downloads/renova-regional-delivery/apply-renova-regional-delivery.sh"
   ```

   The installer detects `Documents/Renova_Store`, checks branch `migration/neon-render`, validates the affected file contents and payload checksums, and backs up the replaced files inside Git's metadata directory. It requires a clean working tree and rolls back an application failure. If Git reports only `tsconfig.tsbuildinfo`, that generated cache can be restored with `git restore -- tsconfig.tsbuildinfo` before retrying.

3. Run:

   ```bash
   cd "$HOME/Documents/Renova_Store" &&
   npm run test:whatsapp &&
   npx tsc --noEmit --incremental false &&
   npm run verify:cumulative &&
   git diff --check
   ```

4. Review `git diff`, then commit and push:

   ```bash
   git add -- app scripts/test-whatsapp.mjs tests DELIVERY_UPDATE.md REGIONAL_DELIVERY_UPDATE.md WHATSAPP_ORDER_CONTROLS.md WHATSAPP_SETUP.md &&
   git commit -m "Use regional delivery estimates throughout Renova" &&
   git push origin migration/neon-render
   ```

5. Wait for the existing Render service to show this commit as **Live**.

No database migration, new dependency, Meta template approval, Cloudflare Worker update or Render setting change is needed. Keep the working template language `en`.

## Use the controls

Go to **Admin → Orders**. Below the order table, **WhatsApp notifications for your orders** shows the controls for each order awaiting delivery. The WhatsApp link beside an order number opens its card in **Admin → Reminders**. Search by order number, customer name, phone or email. The All orders option includes historical and completed records.

- **New checkout orders:** confirmation and daily WhatsApp updates remain automatic after COD confirmation or server-verified prepaid payment.
- **Historical orders:** confirm the customer's WhatsApp number and record their agreement, then select **Send WhatsApp notification**. The first message gives the current order progress, items, amount and delivery estimate. It does not claim an old order was just received. No other historical order is enrolled by this click.
- **Stop WhatsApp notifications:** pauses WhatsApp for this order and cancels its queued WhatsApp sends. It preserves the customer agreement, order status, other orders and selected email/SMS channels.
- **Restart WhatsApp notifications:** sends one current progress update immediately and starts a new daily interval. Repeated clicks while already on do not send extra messages.
- **Customer STOP:** is a customer opt-out for that number's current orders. It cannot be overridden by the restart control.

WhatsApp shows On/Off, the next schedule and recent queued/accepted/delivery statuses. Meta acceptance is followed by delivery receipts; verify arrival on the recipient's phone. A send already in progress when stopped can still arrive. If a send is uncertain, check Meta before using its existing retry control.

Updates wait at least 24 hours after the last accepted WhatsApp message. They continue when delivery takes longer than the estimated delivery window and stop when paused, opted out or the order is delivered, collected, cancelled or refunded. Unconfirmed/unpaid orders cannot be started through these controls.

For a delayed order, open **Edit messages for this order → Daily delivery update**. Enter verified courier information and the latest confirmed delivery estimate, then **Save message wording**. Specific dates are preserved. The regional working-day estimate is not a new countdown each time a message arrives.

SMS uses the delivery phone. WhatsApp uses the separately recorded WhatsApp number. Starting WhatsApp does not trigger an extra email or SMS.

## Check after deployment

Use a historical QA order and a WhatsApp number you control. Record agreement, start it and check that one current-progress message arrives. Confirm the WhatsApp number and On status, then stop, verify Off and restart. Check that no extra message is created by a repeated start request and that the next routine message waits 24 hours. Test STOP on a QA order, then cancel the QA order after checking. Do not mark a test parcel delivered unless it really was delivered.

Local verification covers the actual PostgreSQL statements, queue, owner-gated route and mocked message provider: 62 regression tests, TypeScript, 86 existing source safeguards and a production build. It includes concurrency, crash recovery, historical consent, separate phone numbers, stop/resume, STOP, payment verification and preservation of other channels. The test runner substitutes only local database/catalogue fixtures and owner identity; live services are not contacted. Live handset delivery and the published webhook still require the checks above.

The estimate is supplied as a variable in the existing [Meta template format](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/types/TemplateObject/), so it does not require editing the approved Facebook template. Historical enrollment and STOP handling retain the consent and opt-out requirements in the [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/).
