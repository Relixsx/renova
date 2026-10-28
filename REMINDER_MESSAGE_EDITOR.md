# Daily and arrival messages

Updated 27 October 2026. Use [SIMPLE_DELIVERY_REMINDERS.md](./SIMPLE_DELIVERY_REMINDERS.md) for the current install, checks and commit/push commands. This follow-up uses the already-applied migration 0007 and needs no new migration.

## Ready-made messages

Renova prepares complete daily and arrival messages automatically. In an order, open **Delivery dates & automatic messages**. Enter Jumia's delivery dates, read the full WhatsApp preview that appears automatically, and select **Save changes**. Names, the website order number, items, payment amount and countdown fill in automatically. There are no variable-insertion buttons.

The normal screen has dates and the customer message. Optional wording changes sit under **Optional: customise the wording**. You can leave that section closed. The standard wording is ready to use, and any genuine existing custom wording is preserved. Blank custom wording uses the ready-made message.

## Three independent messages

1. **Order confirmation:** automatic when the COD order is confirmed or prepaid payment is verified. Reminder edits and Jumia dates do not change its regional estimate.
2. **Daily delivery update:** counts down against that order's saved Jumia window using Nigeria calendar days. Without dates, it uses the order's normal estimate and current progress. Actual dispatch status controls any on-the-way wording.
3. **Arrival and collection reminder:** uses its own ready-made or optional custom wording. Enter verified collection details and explicitly confirm arrival before starting it. Dates alone never start it.

Saving dates or wording does not send immediately, opt a customer in, enable channels, resume a paused order or change the 24-hour schedule. STOP and terminal order statuses still end updates. A send already in progress may still arrive after stopping or changing phase.

## Optional fields

Optional per-order changes include the message body, fallback delivery/collection line, customer instructions, verified courier information, and email subject/heading. Jumia dates take priority over the daily fallback line. Clear the dates and save to use that fallback again.

Under **Admin → Reminders**, **Optional: change the store's message wording** sets defaults for orders without corresponding custom wording. Existing specific order notes and dates are retained. The first confirmation stays separate.

WhatsApp uses the existing approved template's greeting and closing. The full preview uses the same formatting and shortening as the sender. Order facts and STOP instructions are retained. Email and SMS keep their respective layouts.

## Arrival reminders

In the arrival tab, enter the verified collection point or arrival details, check the confirmation of courier verification, then choose **Confirm arrival and start arrival reminders**. A stopped order instead records arrival and keeps notifications off. Use the existing channel controls to restart when appropriate and with the customer's agreement.

The initial verified arrival update may send promptly. Later recurring updates wait a full 24 hours. Mark collection/delivery only when true, or use the stop controls. Editing wording cannot override customer STOP.
