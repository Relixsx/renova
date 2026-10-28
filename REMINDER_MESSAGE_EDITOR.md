# Customer message editor

Updated 28 October 2026. Follow [ORDER_MESSAGE_WORKSPACE.md](./ORDER_MESSAGE_WORKSPACE.md) for the current installer, verification and commit/push commands. The installed database migration 0007 is unchanged.

Open **Admin → Orders** or **Admin → Reminders**, find the order and open **Delivery dates & automatic messages**. The three primary tabs are always visible:

1. **Order confirmation:** review the automatic first message. It has its own read-only preview. Daily/arrival edits and Jumia dates do not change or resend it.
2. **Daily delivery update:** edit the visible **Your message to the customer** field. Change Jumia dates and optional instructions, then select **Save daily update**. The name, order number, items, payment, actual progress and countdown remain automatic.
3. **Arrival & collection:** edit its own message and verified collection details. **Save arrival wording** sends nothing. Explicit courier verification and the separate arrival-start button are required before it can send.

The editing column and customer preview are separate. On smaller screens they stack. Selecting Email reveals subject/heading fields. WhatsApp, email and SMS have their respective previews. The old nested wording/other-message menus and duplicate previews are removed.

Saving one tab retains unsaved changes in the other. Each tab has its own save button and unsaved-change marker. **Use store default wording** resets that message's draft; save to apply it. **Store message defaults** under Admin → Reminders applies where an order has no custom wording. Specific courier notes and dates remain with their orders.

Countdown numbers are not part of the editable paragraph. They recalculate for each send from the current Nigeria date and the saved Jumia window. Today/tomorrow examples are visible in the dates card. A saved window of 6–10 November shows 9–13 days on 28 October, 8–12 on 29 October and 7–11 on 30 October.

Saving and previewing do not enable a channel, opt a customer in, resume a stopped order or change the 24-hour schedule. STOP and terminal order statuses still end updates. A send already in progress may still arrive after stopping or changing phase.

The existing approved WhatsApp greeting and closing remain fixed. The full preview uses the sender's formatting and length limits; order facts and STOP instructions are retained. Arrival is never inferred from an estimated date.
