# Jumia dates and daily delivery countdowns

26 October 2026. This replacement update combines the uninstalled daily/arrival message editors with the Jumia countdown. It applies directly to Renova's regional-delivery commit `a2062b8`, branch `migration/neon-render`.

## Install this combined update

Download the updated `renova-message-editor-20261023.zip`, unzip it in Downloads, and use the new **renova-delivery-countdown** folder. Only this replacement download is needed. The filename keeps the earlier download's name; the contents and extracted folder are updated.

```bash
bash "$HOME/Downloads/renova-delivery-countdown/apply-renova-delivery-countdown.sh" &&
cd "$HOME/Documents/Renova_Store" &&
npm run test:whatsapp &&
npx tsc --noEmit --incremental false &&
npm run verify:cumulative &&
git diff --check &&
bash scripts/migrate-reminder-messages.sh
```

The final command privately prompts for the restored NEW Neon connection string. This one-time combined migration `0007_editable_reminder_messages` adds the editor settings, arrival phase and Jumia date pair in one transaction. Run it successfully before committing/pushing. Existing orders, products, accounts, consent and schedules remain in place. A retry recognizes the same migration. No new dependencies, Render settings, Meta template changes or Worker changes are needed.

The installer requires a clean local repository, verifies the branch and affected source hashes, and makes backups before applying. If only `tsconfig.tsbuildinfo` is modified, restore that generated cache with `git restore -- tsconfig.tsbuildinfo`; preserve other edits. The installer does not contact the database or send customer messages. The migration does not send messages either.

For review, commit and push commands, use [REMINDER_MESSAGE_EDITOR.md](./REMINDER_MESSAGE_EDITOR.md). Wait for Render to show the new commit **Live** before using these controls.

## Enter the dates after placing the Jumia order

1. Open **Admin → Orders** or **Admin → Reminders** and find the customer's order.
2. Open **Edit messages for this order → 2. Daily delivery update**.
3. Under **Jumia expected delivery dates**, enter Jumia's **Expected from** and **Expected to** dates. For one date, leave Expected to blank.
4. Edit any additional daily wording or verified courier progress. Choose **Preview all three messages** to see the WhatsApp, email and SMS copies without sending anything.
5. Select **Save message & Jumia dates**. The next scheduled update uses the saved dates. Saving does not send immediately or restart stopped reminders.

Each order has its own window. Changing one does not change another. Enter a revised window if Jumia revises its estimate. **Clear Jumia dates**, then save, to return to that order's normal delivery estimate. Clearing the draft alone does not change the saved dates.

## What customers receive

For a saved window of **1–3 November 2026**, the daily countdown changes like this:

| Sending date in Nigeria | Daily opening |
| --- | --- |
| 27 October | Your order is expected in 5–7 days. |
| 28 October | Your order is expected in 4–6 days. |
| 29 October | Your order is expected in 3–5 days. |
| 30 October | Your order is expected in 2–4 days. |
| 31 October | Your order is expected in 1–3 days, starting tomorrow. |
| 1 November | Your order is expected today or within the next 2 days. We will notify you once arrival is confirmed. |
| 2 November | Your order is expected today or tomorrow. We will notify you once arrival is confirmed. |
| 3 November | Your order is expected today. We will notify you as soon as arrival is confirmed. |
| 4 November, still unconfirmed | The estimated delivery window has passed; arrival is not yet confirmed. We will share a verified update. |

The calculation uses **calendar days in Africa/Lagos**, including weekends. It is recalculated on every actual send, rather than storing yesterday's number or counting from the website order date. The existing full 24-hour interval between recurring WhatsApp updates remains in force; the scheduler checks due work using its existing configuration.

For payment-on-delivery orders, the countdown is followed by **Please keep your payment ready for delivery.** and the amount due. Prepaid orders retain their paid wording and do not ask the customer to prepare payment again. An overdue update does not repeat the payment-preparation sentence.

The countdown is followed by the editable daily wording, actual order items/payment facts and the WhatsApp STOP instruction. Jumia's exact date window supplies the daily expected-delivery line. The preview uses the same WhatsApp length limit and shortening as sending. The greeting and closing remain those of the existing approved Meta template.

## The three messages stay separate

- **Order confirmation:** automatic, with the website's Lagos (3–5 working days) or outside-Lagos (3–12 working days) estimate. Jumia dates entered later never alter it.
- **Daily delivery reminder:** editable additional wording plus the current Jumia countdown when dates are saved. Without dates, it uses the existing delivery estimate and progress. A date estimate alone does not say the parcel has been dispatched.
- **Arrival and collection reminder:** independently editable. It starts only after you enter verified arrival/collection details and explicitly confirm arrival. An estimated date reaching zero never starts it. It can also be confirmed early if the courier verifies early arrival.

Store defaults apply where an order has no corresponding custom wording. The two optional variables `{{delivery_countdown}}` and `{{jumia_delivery_window}}` are available alongside the existing order-detail variables. The countdown opening is always included in daily messages with saved dates, even if its variable is not inserted. Arrival messages do not receive the countdown opening.

The on/off controls, customer agreement and STOP handling remain in effect. Saving dates does not enroll an old order or resume a paused one. For an older order, use its existing WhatsApp start control with the recorded customer agreement. Mark the order collected/delivered or stop its reminders when complete.

## Verification

99 local regression tests passed, including simulated real sends across successive dates, Nigeria midnight, month/year/leap-day boundaries, invalid/reversed windows, date revisions/clearing, no automatic arrival, confirmation isolation, previews without writes, paid/COD wording, 24-hour timing and transactional migration rollback/retry. TypeScript, 88 source safeguards, changed-source ESLint, the production build and rendered HTML check also passed.

After deployment, check one QA order using a recipient number you control. Saving and previewing should send nothing; the next scheduled message should show that day's countdown. Confirm arrival only for a verified QA parcel, then stop its reminders when the check is complete. No live database was contacted or customer message sent during preparation of this update.
