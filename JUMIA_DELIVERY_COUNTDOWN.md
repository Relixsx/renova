# Jumia dates and daily delivery countdowns

Latest 28 October update: see [ORDER_MESSAGE_WORKSPACE.md](./ORDER_MESSAGE_WORKSPACE.md). All three messages now have visible tabs, daily and arrival wording are directly editable, and the delivery-date card shows today’s and tomorrow’s automatic countdown. This follow-up needs no database migration.

Countdown installed 26 October 2026; screen simplified 27 October 2026. The Jumia dates and the existing migration 0007 are retained on branch `migration/neon-render`.

## Current follow-up update

The 26 October countdown package and migration 0007 are already installed. Use [SIMPLE_DELIVERY_REMINDERS.md](./SIMPLE_DELIVERY_REMINDERS.md) and the new `renova-simple-reminders-20261027.zip` for the simpler automatic-message screen. This follow-up needs no new database migration.

## Enter the dates after placing the Jumia order

1. Open **Admin → Orders** or **Admin → Reminders** and find the customer's order.
2. Open **Delivery dates & automatic messages → 2. Daily delivery update**.
3. Under the Jumia delivery dates, enter **Expected from** and **Expected to**. For one date, leave Expected to blank.
4. The complete customer WhatsApp message appears automatically with the actual name, website order number, items, payment and countdown. No wording or detail buttons are required.
5. Select **Save daily update**. The next scheduled reminder uses those dates; saving and previewing send nothing immediately.

Each order has its own window. Changing one does not change another. Enter a revised window if Jumia revises its estimate. **Clear dates**, then save, to return to that order's normal delivery estimate. Clearing the draft alone does not change the saved dates.

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

Store defaults apply where an order has no corresponding custom wording. The daily and arrival text fields are visible in their own tabs. The daily countdown is included automatically whenever dates are saved. Arrival messages keep their own wording and do not receive the countdown opening.

The on/off controls, customer agreement and STOP handling remain in effect. Saving dates does not enroll an old order or resume a paused one. For an older order, use its existing WhatsApp start control with the recorded customer agreement. Mark the order collected/delivered or stop its reminders when complete.

## Verification

101 local regression tests passed, including simulated real sends across successive dates, Nigeria midnight, month/year/leap-day boundaries, invalid/reversed windows, date revisions/clearing, no automatic arrival, confirmation isolation, previews without writes, paid/COD wording, 24-hour timing and transactional migration rollback/retry. TypeScript, 88 source safeguards, changed-source ESLint, the production build and rendered HTML check also passed.

After deployment, check one QA order using a recipient number you control. Saving and previewing should send nothing; the next scheduled message should show that day's countdown. Confirm arrival only for a verified QA parcel, then stop its reminders when the check is complete. No live database was contacted or customer message sent during preparation of this update.
