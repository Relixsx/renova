# Editable daily and arrival reminders

Updated 26 October 2026. This combined update includes the message editors and the Jumia countdown. Apply it directly after regional-delivery commit `a2062b8` on branch `migration/neon-render`. The earlier message-editor download was not installed; use this replacement ZIP only. See [JUMIA_DELIVERY_COUNTDOWN.md](./JUMIA_DELIVERY_COUNTDOWN.md) for date examples and the daily workflow.

## The three messages

1. **Order confirmation:** the automatic thank-you, order items, amount and regional delivery estimate stay separate from reminder edits. COD confirmation and verified prepaid payment keep their existing triggers.
2. **Daily delivery update:** enter the order's Jumia expected-from/to dates after placing the Jumia order. Each scheduled send recalculates the calendar-day countdown using Nigeria time. Edit the additional wording, fallback expected-delivery line, customer instructions and email subject/heading separately. The saved date window takes priority over the fallback line. Without dates, the existing delivery estimate and progress remain in use. The default only says the order is on the way after dispatch.
3. **Arrival and collection reminder:** edit its own message, collection line, customer instructions and email subject/heading. Enter verified arrival/collection details and confirm that the parcel has arrived. That transition replaces delivery-progress reminders with arrival reminders. When notifications are on, it attempts one arrival update and then waits at least 24 hours between recurring WhatsApp updates. Repeated arrival clicks do not send another first-arrival message.

Order items, payment facts, the recorded recipient and WhatsApp STOP instructions remain automatic. The editable content fits inside the existing approved `renova_delivery_update` WhatsApp template, in language `en`. Its fixed greeting, order heading and closing are visible in the preview. Editing that fixed wording would be a separate Meta template change; this update edits the message section and delivery/collection value, without replacing the working template. No new Meta approval, access token, Worker code or Render environment variable is required for these fields.

## Install and verify locally

Download the replacement `renova-message-editor-20261023.zip` and unzip it in Downloads. This revision extracts a **renova-delivery-countdown** folder. Do not apply the older message-editor folder first.

```bash
bash "$HOME/Downloads/renova-delivery-countdown/apply-renova-delivery-countdown.sh" &&
cd "$HOME/Documents/Renova_Store" &&
npm run test:whatsapp &&
npx tsc --noEmit --incremental false &&
npm run verify:cumulative &&
git diff --check
```

The installer finds `Documents/Renova_Store`, verifies the affected source files and branch, and backs up replacements inside Git's metadata directory. It requires a clean working tree and rolls back an application failure. It does not push, deploy, connect to Neon or send customer messages. It adds no dependencies.

If the only local change is the generated `tsconfig.tsbuildinfo`, that cache can be restored with `git restore -- tsconfig.tsbuildinfo` before retrying. Preserve any other local edits.

## Apply the one-time database update before pushing

```bash
cd "$HOME/Documents/Renova_Store" &&
bash scripts/migrate-reminder-messages.sh
```

Paste the connection string for your **restored NEW Neon database** into the hidden Terminal prompt. Do not paste the connection string into chat or a source file. Both its pooled and direct connection strings are accepted.

The one combined migration, `0007_editable_reminder_messages`, adds the message-default settings table, per-order message/arrival fields and Jumia date pair. It retains existing orders, products, accounts, consent, notes and schedules. It widens the existing queue index to cover recurring arrival messages and checks that the end date is on or after the start date. The migration locks and checks the migration history, applies its changes in one transaction and recognizes an already-applied update on retry. It sends no notifications. The earlier `0006` helper remains compatible with the additional migration. There is no separate countdown migration to run.

Wait for **Message-editor migration completed in one transaction** or **Message-editor migration is already applied** before proceeding. A wrong destination or inconsistent history stops the migration.

## Commit and deploy

Review `git diff`, then:

```bash
cd "$HOME/Documents/Renova_Store" &&
git diff --check &&
git add -- app db drizzle-neon scripts tests REMINDER_MESSAGE_EDITOR.md JUMIA_DELIVERY_COUNTDOWN.md WHATSAPP_SETUP.md WHATSAPP_ORDER_CONTROLS.md REMINDER_BOT_SETUP.md &&
git commit -m "Add editable reminders with per-order delivery countdowns" &&
git push origin migration/neon-render
```

Wait for the new commit to show **Live** on Render before using the editor.

## Edit the default wording

Open **Admin → Reminders → Edit default daily and arrival messages**. Choose the daily or arrival tab. Edit and preview an example, then **Save default messages**. Default changes apply to orders without a corresponding per-order override. Existing order-specific courier dates and notes are retained.

The first confirmation is separate from both defaults. Restoring an original default changes the draft first; saving applies it.

## Edit an individual order

In **Admin → Orders** or **Admin → Reminders**, find an order and open **Edit messages for this order**.

- Choose **2. Daily delivery update** or **3. Arrival and collection reminder**.
- In the daily tab, enter **Expected from** and **Expected to** from Jumia, or leave the second field blank for one expected date.
- Edit the message, fallback delivery/collection line, instructions and optional email fields. The daily fallback line is disabled while a Jumia date window is in use.
- Use the detail buttons to insert the customer's name, order number, current status, courier update, tracking link, countdown or Jumia date window. These are replaced with the actual order details. The daily countdown is added automatically even if its variable is omitted from the editable body.
- Enter daily courier progress and arrival/collection details separately.
- Select **Preview all three messages** to see the actual WhatsApp layouts and the email/SMS previews. Previewing sends nothing and does not confirm arrival.
- Select **Save message & Jumia dates** in the daily tab, or **Save message wording** in the arrival tab. Saving does not send, enable a channel, opt a customer in, restart a paused order, change the phase or advance its sending schedule.
- **Use store default for this message** resets only that message's overrides after you save. Other message types stay independent.

With saved Jumia dates, the daily expected-delivery line shows that exact date window. Clear both dates and save to return to the fallback. Without Jumia dates, blank daily delivery text uses the order's Lagos (3–5 working days) or outside-Lagos (3–12 working days) estimate, or its specific courier date. An explicitly entered new fallback line is retained as entered. Blank arrival/collection text uses **Ready for collection now**. The initial confirmation continues using the regional estimate regardless of Jumia dates.

The countdown uses calendar dates, not working days, and is recalculated at send time. Within the window, it uses wording such as "expected today or tomorrow". After the window, it explains that the estimate has passed and arrival is not yet confirmed. Update the Jumia dates when the courier provides a revised estimate. Reaching an estimated date never confirms arrival automatically.

WhatsApp condenses line breaks and can shorten expanded text to fit its approved layout. The full preview uses the same formatting and shortening as the actual outgoing WhatsApp message. Order facts and STOP instructions are retained. Email and SMS use the same selected message wording, with their respective layouts.

## Start arrival reminders

Open the order's arrival tab, enter the verified arrival/collection details, and select the checkbox confirming the courier's information. Then select **Confirm arrival and start arrival reminders**. Entering text or previewing alone never starts arrival messages.

If notifications are off, the action records arrival and keeps them off. Restart the order's notifications through the existing controls when ready. Starting WhatsApp uses the recorded recipient and still requires the customer's agreement. Customer STOP cannot be overridden by editing or restarting.

An initial verified arrival update can be sent promptly even if a delivery-progress update was sent recently. Later recurring arrival messages observe the full 24-hour interval. Provider acceptance is followed by delivery receipts; check the recipient's phone during a QA test. A send already in progress can still arrive when the phase changes or notifications stop.

Stop WhatsApp through the existing order controls, or stop all selected channels under **Delivery notes, message previews and other channels**. Mark an order delivered/collected only when that is true; terminal order status also ends reminders.

## Local validation and a live QA check

Local validation passed 99 regression tests, TypeScript, 88 source safeguards, changed-source ESLint, a production build and the rendered HTML check. The tests use real PostgreSQL execution through PGlite and mocked providers. They cover date-window validation, countdown changes across Nigeria midnight/month/year boundaries, actual sends on successive dates, revised/cleared/overdue dates, independent defaults and per-order fields, previews without side effects, keeping confirmation wording separate, HTML escaping, consent/STOP, concurrent arrival activation, 24-hour timing, recovery after a crash, an in-flight delivery-send race, and migration rollback/retry.

After Render shows Live, use an existing QA order and a recipient number you control. Preview all three messages with a future Jumia date window, save a daily edit, and check that no immediate message is sent by saving. Verify the first confirmation preview retains its regional estimate and a stopped order stays stopped. Check the next scheduled daily send on the recipient's phone. Confirm arrival for that QA parcel only when appropriate, check that one arrival update is queued/accepted and arrives, and check the next schedule. Stop the QA reminders after testing. Local tests do not verify live credentials, the webhook or handset delivery.
