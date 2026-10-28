# Customer reminder setup

Current message editor: see [FULL_REMINDER_MESSAGE_EDITOR.md](./FULL_REMINDER_MESSAGE_EDITOR.md). Type directly in the customer view to change wording, items and reminder amount. The Jumia date line and bold days remaining stay automatic. Printed STOP instructions are arrival-only; incoming opt-outs are honoured at every stage. The current ZIP includes the message layout and reminder-status filters and needs no new migration or Meta configuration.

For the 22 October checkout update on the already deployed integration, follow [CHECKOUT_UPDATE.md](./CHECKOUT_UPDATE.md); no new migration is needed. [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md) retains the original installation sequence for a fresh setup.

Existing email/SMS channels and the manual Jumia arrival workflow remain in Admin → Reminders.

- Email: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (or the existing `ORDER_FROM_EMAIL` fallback).
- Optional SMS: `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_CHANNEL` and, if needed, `TERMII_API_URL`.
- WhatsApp: the existing approved `renova_delivery_update` template, language `en`, tested API `v25.0`, and the private settings in the new guide.
- Scheduler: `POST /api/orders/reminders/run` with `Authorization: Bearer <REMINDER_CRON_SECRET>`. Configure the same secret in Render and the existing reminder Worker.
- Cron: `*/5 * * * *` checks due work every five minutes. Routine WhatsApp updates wait at least 24 hours after the last accepted WhatsApp message.

**Save for next update** changes the stored note without sending immediately. **Save update & send now** and **Send Jumia arrival update** deliberately send an immediate update. Use verified courier information and the latest estimate. An empty note uses the current order stage.

Confirm agreement for each selected channel. New checkout customers provide a separate WhatsApp number and request order updates when they place their order. They receive confirmation and daily updates automatically. The delivery phone remains separate; admin saves preserve the WhatsApp number. The three message tabs separate the automatic confirmation, editable daily message and arrival reminder. Older customers require recorded consent before WhatsApp is enabled. Stop after collection or mark an order delivered/cancelled/refunded. Customer STOP replies disable WhatsApp for that number's current orders while preserving other selected channels.

The dashboard distinguishes queued, accepted, failed and receipt statuses. Credential presence does not prove validity, and API acceptance does not prove handset delivery.

## Reminder status filters

Open **Admin → Reminders** and select **Running**, **Stopped**, **Not started** or **All**. Each shows its total and works with order/customer search. Past active schedules remain visible under Running. Use **Stop all reminders** in an order header to stop its schedule across all channels; its saved messages and Jumia dates stay in place. A WhatsApp-only pause remains available separately. See `REMINDER_STATUS_FILTERS.md` for installation and verification.
