# Customer message workspace

The current installation and message-editing guide is [FULL_REMINDER_MESSAGE_EDITOR.md](./FULL_REMINDER_MESSAGE_EDITOR.md).

Open an order under **Admin → Orders** or **Admin → Reminders**, then open **Delivery dates & automatic messages**.

| Tab | Behavior |
| --- | --- |
| 1. Order confirmation | Automatic first message with its own read-only preview; editing reminders does not resend it |
| 2. Daily delivery update | Type directly in the complete customer paragraph, including items and amount; enter Jumia dates and save |
| 3. Arrival & collection | Edit its own complete paragraph and collection information; explicit verified arrival is required to start it |

The highlighted customer-message field accepts clear-and-replace typing, trailing spaces and unfinished edits without restoring the default. The sender uses saved full message corrections directly. The expected-delivery line and bold days remaining stay separate and automatic, while the approved Meta greeting and closing remain fixed. Restoring the automatic message restores the order's recorded facts as well.

For 6–10 November 2026, WhatsApp shows **9 days remaining** on 28 October, **8 days remaining** on 29 October and **7 days remaining** on 30 October, after the date window. It calculates this again for every send using Nigeria time. These dates do not change the first confirmation. Delivery reaching its estimate does not confirm arrival.

Daily and arrival drafts/save actions remain independent. Saving or previewing sends nothing and changes neither consent nor the schedule. Message-only amount corrections leave invoices, products and payment records intact. Printed STOP wording is arrival-only; actual customer opt-out requests are honoured at every stage.

The same update includes the [Running/Stopped filters](./REMINDER_STATUS_FILTERS.md). See the full editor guide for the one ZIP installer, current checks and commit/push command. No new database or Meta configuration step is needed.
