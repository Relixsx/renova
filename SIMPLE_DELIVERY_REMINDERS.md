# Delivery reminders

Use the current [full customer-message editor](./FULL_REMINDER_MESSAGE_EDITOR.md) for installation and editing. It includes the recent message layout and reminder-status filters.

1. Open the order and choose **2. Daily delivery update**.
2. Enter the Jumia delivery dates when available.
3. Edit the full customer paragraph directly if you need to change wording, quantities, products or the reminder amount.
4. Select **Save daily update**. Saving sends nothing and keeps the existing 24-hour schedule.

The customer name and order reference are filled in automatically. The saved Jumia dates control the expected-delivery line and bold days remaining, recalculated for each actual send in Nigeria time. The default regional estimate is used until dates are available. No name/countdown insertion buttons or OpenAI integration are needed.

Daily and arrival text are independent. Arrival needs verified collection details and explicit activation. The first confirmation remains automatic with a read-only preview. Incoming STOP and owner stop controls remain effective; the printed Reply STOP sentence appears on arrival reminders only.

Use **Running**, **Stopped**, **Not started** and **All** to find orders. Stop all reminder channels from a running order's header. The same ZIP includes these filters, and no new database or environment change is needed.
