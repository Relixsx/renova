# Customer reminder setup

Latest 27 October follow-up: use [SIMPLE_DELIVERY_REMINDERS.md](./SIMPLE_DELIVERY_REMINDERS.md). Enter the Jumia dates and save; the complete customer message is prepared and previewed automatically. Optional wording changes are collapsed. This follow-up uses the installed migration 0007 and needs no new migration.

Latest 26 October combined update: see [JUMIA_DELIVERY_COUNTDOWN.md](./JUMIA_DELIVERY_COUNTDOWN.md) for per-order Jumia date ranges and daily countdowns. [REMINDER_MESSAGE_EDITOR.md](./REMINDER_MESSAGE_EDITOR.md) covers separate editable daily/arrival messages, previews and the one combined migration 0007. It replaces the uninstalled 23 October editor download.

For the 22 October checkout update on the already deployed integration, follow [CHECKOUT_UPDATE.md](./CHECKOUT_UPDATE.md); no new migration is needed. [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md) retains the original installation sequence for a fresh setup.

Existing email/SMS channels and the manual Jumia arrival workflow remain in Admin → Reminders.

- Email: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (or the existing `ORDER_FROM_EMAIL` fallback).
- Optional SMS: `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_CHANNEL` and, if needed, `TERMII_API_URL`.
- WhatsApp: the existing approved `renova_delivery_update` template, language `en`, tested API `v25.0`, and the private settings in the new guide.
- Scheduler: `POST /api/orders/reminders/run` with `Authorization: Bearer <REMINDER_CRON_SECRET>`. Configure the same secret in Render and the existing reminder Worker.
- Cron: `*/5 * * * *` checks due work every five minutes. Routine WhatsApp updates wait at least 24 hours after the last accepted WhatsApp message.

**Save for next update** changes the stored note without sending immediately. **Save update & send now** and **Send Jumia arrival update** deliberately send an immediate update. Use verified courier information and the latest estimate. An empty note uses the current order stage.

Confirm agreement for each selected channel. New checkout customers provide a separate WhatsApp number and request order updates when they place their order. They receive confirmation and daily updates automatically. The delivery phone remains separate; admin saves preserve the WhatsApp number. The two preview panels show the initial confirmation and next daily update. Older customers require recorded consent before WhatsApp is enabled. Stop after collection or mark an order delivered/cancelled/refunded. Customer STOP replies disable WhatsApp for that number's current orders while preserving other selected channels.

The dashboard distinguishes queued, accepted, failed and receipt statuses. Credential presence does not prove validity, and API acceptance does not prove handset delivery.
