# Edit the customer message, items and amount

28 October 2026. This bundle includes the message workspace and Running/Stopped filters. Install it over the 27 October simple-reminders, 28 October message-workspace, or 28 October reminder-filters update on `migration/neon-render`. The existing database migration 0007 is retained. No new migration, dependency, Meta template, API key, environment variable or scheduler change is required.

## Edit the daily message directly

Open **Admin → Reminders**, find the order, open **Delivery dates & automatic messages**, and choose **2. Daily delivery update**.

The customer view now says **Edit customer message**. Type in its large **Daily message including items and amount** box. The box starts with the complete outgoing customer paragraph, including the wording, products, quantities and payment details. Clear and replace it, add spaces or line breaks while drafting, or change individual words and numbers. The approved template sends this editable section as one paragraph; saving displays its normalized outgoing text.

For example, replace **₦33,700** with **₦58,000** and edit the item list to include both products. Select **Save daily update**. The sender uses that edited paragraph without adding the old amount or item summary back onto it. Reopening the order loads the saved message.

This is a reminder-text correction. It does not change the order's recorded amount, invoice, products, payment verification or a confirmation already sent. Daily and arrival wording remain independent. Edit the arrival message separately if that reminder also needs a correction.

The customer's name and website order number remain automatic. The greeting, introduction and closing are fixed parts of the approved Meta template; changing those fixed sentences requires an approved template change. The editable section is clearly outlined inside the full customer view. Email and SMS use the saved full reminder paragraph too, without appending the previous recorded amount.

**Restore automatic message and order details** resets the selected message to the automatic wording and the order's recorded facts. Save to apply a reset. Editing or previewing sends nothing, does not activate reminders and does not change the 24-hour schedule. Unsaved edits remain available after a save error.

## Automatic bold countdown after the delivery dates

Enter Jumia's **Expected from** and **Expected to** dates, then save the daily update. The expected-delivery line uses those dates instead of the general regional estimate.

For **6–10 November 2026**, the WhatsApp expected-delivery line contains:

| Sending date in Nigeria | Bold text after the date window |
| --- | --- |
| 28 October | **9 days remaining until the delivery window starts.** |
| 29 October | **8 days remaining until the delivery window starts.** |
| 30 October | **7 days remaining until the delivery window starts.** |

The countdown is outside the editable paragraph. It is recalculated for every actual send using Nigeria calendar days, even when the message was queued before midnight. It counts to the beginning of the window and retains the full 6–10 November window. The preview's Today/Tomorrow examples and bold line refresh when the Nigeria date changes or you return to the page.

During the window, the line says the delivery window is open and gives the remaining time. On its last day, it says expected today and awaits confirmation. If the window passes, it says the estimate passed. It never shows negative days or automatically declares the parcel delivered or ready for collection.

The bold countdown follows the dates within the existing template's expected-delivery line. WhatsApp receives its normal single-asterisk bold formatting. No fifth template parameter or Meta template edit is introduced. See [WhatsApp message formatting](https://faq.whatsapp.com/539178204879377/) and [Meta template parameters](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/).

## STOP wording and arrival reminders

The printed **Reply STOP** sentence is removed from new order confirmations, daily updates and ordinary manually started delivery updates. Arrival and collection reminders retain it. Incoming customer requests to stop WhatsApp are honoured at any stage, including before arrival, as required by the [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy).

In **3. Arrival & collection**, edit the full arrival paragraph independently. Its collection details and explicit courier-verification checkbox still control arrival activation. A delivery date reaching zero does not activate arrival reminders. Owner stop controls, customer opt-outs, unpaid/completed-order exclusions and the full 24-hour interval remain in effect.

## Checkout notice cleanup

The large green final-checkout notice is replaced by a compact **Your order updates** section. It states that placing the order requests an order confirmation and daily delivery updates at the customer's WhatsApp number, with a privacy-policy link. Printed STOP instructions are removed from the contact-number hint, final review and payment-on-delivery confirmation dialog. Automatic confirmations and daily reminders continue normally.

New checkout pages record notice version `checkout-v3`. In-progress pages using `checkout-v2` remain accepted and retain their original notice version; historical v1/v2 orders keep their eligibility. There is no new checkbox, migration, payment flow or scheduler change.

Use this updated ZIP in place of the previous download. Replace the previously extracted **renova-full-message-editor** folder in Downloads before running the installer. It also supports a clean repository with the earlier full-message-editor bundle installed.

## Install and verify

Download **renova-full-message-editor-20261028.zip** and unzip it in Downloads. It extracts **renova-full-message-editor**. This single download includes the recent reminder-status filters and three-message layout.

```bash
bash "$HOME/Downloads/renova-full-message-editor/apply-renova-full-message-editor.sh" &&
cd "$HOME/Documents/Renova_Store" &&
npm run test:whatsapp &&
npx tsc --noEmit --incremental false &&
npm run verify:cumulative &&
git diff --check
```

The installer checks the source and branch, requires a clean repository, backs up replaced files inside Git metadata and rolls back a failed application. It refuses unknown committed changes. If only the generated `tsconfig.tsbuildinfo` cache is modified, `git restore -- tsconfig.tsbuildinfo` restores that cache; preserve other edits.

After reviewing the changes and passing checks:

```bash
cd "$HOME/Documents/Renova_Store" &&
git diff --check &&
git add -- app scripts/test-whatsapp.mjs tests CHECKOUT_UPDATE.md FULL_REMINDER_MESSAGE_EDITOR.md REMINDER_STATUS_FILTERS.md ORDER_MESSAGE_WORKSPACE.md SIMPLE_DELIVERY_REMINDERS.md JUMIA_DELIVERY_COUNTDOWN.md REMINDER_MESSAGE_EDITOR.md WHATSAPP_SETUP.md WHATSAPP_ORDER_CONTROLS.md REMINDER_BOT_SETUP.md &&
git commit -m "Improve WhatsApp message editing and checkout notices" &&
git push origin migration/neon-render
```

Wait for this commit to show **Live** on Render, then refresh the admin page. Downloading the ZIP alone does not update the live store. After deployment, check the editable body and saved dates on a QA order before its next scheduled send.

## Verification

123 regression tests pass. They include the actual owner API and embedded PostgreSQL fixture for saving two-product/₦58,000 corrections, reloading them, and sending them on three successive days with bold 9/8/7-day countdowns. Those tests verify that the old amount is absent from WhatsApp, email and SMS, the stored order data is retained, saving sends nothing, STOP remains effective, and a length failure causes no partial writes. Existing checkout, payment, cart clearing, signatures, scheduling, concurrency and migration safeguards remain covered.

Additional React DOM interaction checks verify deletion, replacement typing, trailing spaces, line breaks, item and amount editing, saving/reloading, date refresh, draft retention after an error, separate arrival/confirmation panels and the Running/Stopped filters. TypeScript, changed-source lint, source safeguards, the production build and rendered HTML are checked before packaging. Full edited messages that exceed the actual WhatsApp limit are rejected before saving instead of silently cutting off their item or payment text.

Preparation and installation do not access the production database, send a customer message, push GitHub or deploy Render. Live browser appearance and handset delivery still need the usual check after deployment.
