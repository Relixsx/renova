# Jumia delivery dates and automatic countdown

The current installer and complete message editor are in [FULL_REMINDER_MESSAGE_EDITOR.md](./FULL_REMINDER_MESSAGE_EDITOR.md).

Enter Jumia's expected-from and expected-to dates on the daily message tab and save. The exact window replaces the general delivery estimate for future daily reminders. For a single date, leave the second date empty. Editing dates does not change the initial confirmation, start a stopped order or send an immediate message.

| Nigeria sending date | Saved window | Bold WhatsApp countdown after the dates |
| --- | --- | --- |
| 28 October 2026 | 6–10 November 2026 | 9 days remaining until the delivery window starts. |
| 29 October 2026 | 6–10 November 2026 | 8 days remaining until the delivery window starts. |
| 30 October 2026 | 6–10 November 2026 | 7 days remaining until the delivery window starts. |

Calendar-day arithmetic uses Africa/Lagos at actual sending time, including queued jobs crossing Nigeria midnight. The open preview refreshes its day on focus or a day change. The full date window remains visible; counting to its start does not guarantee arrival on that date.

While the window is open, wording gives the remaining time and awaits verified arrival. On the final day it says expected today; after the window it says the estimate passed. It never displays negative remaining days or treats the date as proof of arrival. Explicit courier verification is still required for arrival reminders.

The message paragraph can be edited directly, including its items and amount, while dates/countdown stay automatic. Owner message corrections do not change payment records. Printing STOP instructions is arrival-only; genuine customer opt-outs are still honoured throughout. The existing four-variable Meta template and 24-hour sending interval are retained.

No new migration or configuration step is needed after the installed migration 0007. The current ZIP includes the three-message workspace and Running/Stopped filters.
