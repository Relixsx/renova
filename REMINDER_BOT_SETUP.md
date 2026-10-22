# Customer reminder setup

Follow [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md) for the complete installation sequence, including migration before GitHub push/Render deployment.

Existing email/SMS channels and the manual Jumia arrival workflow remain in Admin → Reminders.

- Email: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (or the existing `ORDER_FROM_EMAIL` fallback).
- Optional SMS: `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_CHANNEL` and, if needed, `TERMII_API_URL`.
- WhatsApp: the existing approved `renova_delivery_update` template, language `en`, tested API `v25.0`, and the private settings in the new guide.
- Scheduler: `POST /api/orders/reminders/run` with `Authorization: Bearer <REMINDER_CRON_SECRET>`. Configure the same secret in Render and the existing reminder Worker.
- Cron: `*/5 * * * *` checks due work every five minutes. Routine WhatsApp updates wait at least 24 hours after the last accepted WhatsApp message.

**Save for next update** changes the stored note without sending immediately. **Save update & send now** and **Send Jumia arrival update** deliberately send an immediate update. Use verified courier information and the latest estimate. An empty note uses the current order stage.

Confirm agreement for each selected channel. Opted-in new checkout customers are enrolled in WhatsApp automatically. Older customers require recorded consent before WhatsApp is enabled. Stop after collection or mark an order delivered/cancelled/refunded. Customer STOP replies disable WhatsApp for that number's current orders while preserving other selected channels.

The dashboard distinguishes queued, accepted, failed and receipt statuses. Credential presence does not prove validity, and API acceptance does not prove handset delivery.
