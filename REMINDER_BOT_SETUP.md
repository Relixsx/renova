# Renova customer reminder bot setup

The update adds a Customer reminder bot section to the existing admin page. Existing orders remain in the `orders` table. The migration only creates `order_reminders` and `order_reminder_logs`.

## Required Render variables

Create a long random value for `REMINDER_CRON_SECRET`. Use the same value in Render and the Cloudflare Worker.

Email uses the existing Resend settings:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (or `ORDER_FROM_EMAIL`)
- `APP_URL=https://shoprenova.com.ng`

WhatsApp Cloud API:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_REMINDER_TEMPLATE`
- `WHATSAPP_TEMPLATE_LANGUAGE=en`
- `WHATSAPP_GRAPH_API_VERSION=v23.0`

The approved WhatsApp template must contain four body variables in this order: customer first name, order number, verified checkpoint, and expected delivery.

Termii SMS:

- `TERMII_API_KEY`
- `TERMII_SENDER_ID=Renova`
- `TERMII_CHANNEL=generic`

## Run the migration

```bash
npm run db:migrate:local
```

The Neon websocket warning is informational when the migration completes and returns to the prompt without an error.

## Schedule automatic delivery

Deploy `deployment/renova-reminder-cron-worker.js` as a Cloudflare Worker. Add these Worker secrets/variables:

- `RENOVA_APP_URL=https://shoprenova.com.ng`
- `REMINDER_CRON_SECRET` — exactly the same secret stored in Render

Add this Cron Trigger so the worker checks hourly:

```text
0 * * * *
```

The Worker can run hourly because Renova itself sends only reminders whose stored 24-hour deadline has arrived. Duplicate scheduler calls are claimed atomically in the database.

## Safe operating procedure

1. In Admin, open Customer reminder bot.
2. Enter only the latest checkpoint confirmed by the courier.
3. Enter the current expected delivery window.
4. Select the configured channels.
5. Confirm the customer's transactional-message consent.
6. Start reminders. The first update sends immediately; later updates send every 24 hours.
7. Update the checkpoint when new verified information arrives.
8. Stop reminders when the parcel is received. Marking the order Delivered also stops them.

Never enter a guessed parcel location. WhatsApp will not send until Meta approves the transactional template, and SMS will not send until Termii approves the sender ID where required.
