# Renova WhatsApp order updates

Latest 27 October follow-up: use [SIMPLE_DELIVERY_REMINDERS.md](./SIMPLE_DELIVERY_REMINDERS.md). Enter the Jumia dates and save; the complete customer message is prepared and previewed automatically. Optional wording changes are collapsed. This follow-up uses the installed migration 0007 and needs no new migration.

Latest 26 October combined update: see [JUMIA_DELIVERY_COUNTDOWN.md](./JUMIA_DELIVERY_COUNTDOWN.md) for per-order Jumia date ranges and daily countdowns. [REMINDER_MESSAGE_EDITOR.md](./REMINDER_MESSAGE_EDITOR.md) covers separate editable daily/arrival messages, previews and the one combined migration 0007. It replaces the uninstalled 23 October editor download.

Latest 22 October update: use [REGIONAL_DELIVERY_UPDATE.md](./REGIONAL_DELIVERY_UPDATE.md) for Lagos (3–5 working days) and outside Lagos (3–12 working days). Use [WHATSAPP_ORDER_CONTROLS.md](./WHATSAPP_ORDER_CONTROLS.md) for per-order start/stop and historical orders.

Source: `Relixsx/renova`, branch `migration/neon-render`. The initial WhatsApp integration was deployed as `123e4e4`.

**22 October checkout update:** if you already installed the integration and migration, follow [CHECKOUT_UPDATE.md](./CHECKOUT_UPDATE.md). That incremental update needs no new database migration, Meta template, Worker deployment or Render environment changes. The original installation steps below are retained for a fresh setup only.

The integration is tested locally. Installation, deployment and a live website test remain to be completed by you. This update reuses the approved `renova_delivery_update` template that reached your handset.

## Customer behavior

- A confirmation contains the customer's name, order number, items, payment information and recorded delivery estimate. The existing checkout marks payment-on-delivery orders confirmed immediately. Paystack orders qualify after the server verifies payment.
- A routine WhatsApp update waits at least 24 hours after the last accepted WhatsApp message. Preparing, packaged and dispatched orders use different wording. Daily updates include the items and payment information; verified courier notes add detail to the actual order stage. The website does not independently track Jumia or invent parcel locations.
- New checkout customers enter a required, separate WhatsApp phone number. The notice beside the order button requests confirmation and daily updates when they place the order; there is no separate WhatsApp checkbox. Delivery/courier calls continue to use the delivery phone number. Historical customers are not enrolled automatically. For an older order, obtain agreement before enabling WhatsApp in Admin → Reminders.
- Daily updates stop after delivery/collection, cancellation, refund, manual stop, or opt-out. The existing manual Jumia arrival message remains available; arrival at a pickup point does not itself prove collection.
- A signed inbound **STOP**, **UNSUBSCRIBE**, or **STOP UPDATES** reply disables WhatsApp for that number's current orders. Other selected channels remain available. A request already in flight may still arrive. A new order requires fresh checkout consent.

## Install before pushing

**Apply the database migration before pushing this code to GitHub.** Render must not deploy code that expects missing database fields.

1. Unzip the update and run `apply-renova-whatsapp.sh`. Select your existing local Renova Git repository. It checks the exact source commit, branch, clean working tree and file hashes, and backs up replaced files. It does not access Neon, install packages or push code.
2. In that repository, run:

   ```bash
   npm ci --legacy-peer-deps
   npm run test:whatsapp
   npx tsc --noEmit
   npm run verify:cumulative
   ```

   Use Node.js 22.13 or newer. The peer option matches the supplied dependency lock. PGlite is a new development dependency for local PostgreSQL tests.

3. Keep your existing store backup. Then run:

   ```bash
   bash scripts/migrate-whatsapp.sh
   ```

   Paste the restored **NEW** Neon connection string at the hidden prompt. Running this from Terminal updates the remote Neon database directly. It accepts the restored endpoint `ep-sweet-cake-bah8seo5.c-8.eu-central-1.aws.neon.tech`, including its pooled variant. It checks the store and six existing migration records, then applies only `0006_whatsapp_order_updates` in one transaction. A SQL error rolls back the entire migration. Running it again after success is safe.

   It adds four nullable order fields, a WhatsApp queue, a receipt table, and an empty default for new reminder notes. Existing orders, products, reminders and Auth records remain. If migration history differs, it stops for inspection. Do not reset, import a backup or run `db:push` for this update.

4. Review and push yourself:

   ```bash
   git status --short
   git diff --stat
   git diff
   git add -- app db deployment drizzle-neon package.json package-lock.json scripts tests WHATSAPP_SETUP.md REMINDER_BOT_SETUP.md
   git commit -m "Connect WhatsApp confirmations and daily delivery updates"
   git push origin migration/neon-render
   ```

   Wait for your existing Render service to deploy this commit. The new sender stays paused until `WHATSAPP_AUTOMATION_ENABLED=true`. Add the WhatsApp credentials after the new code is deployed; older code does not understand this pause switch.

## Render environment

Keep the existing database, Auth, payment and email configuration. Add:

| Variable | Value |
| --- | --- |
| `WHATSAPP_AUTOMATION_ENABLED` | `false` during setup; `true` for the live test |
| `WHATSAPP_ACCESS_TOKEN` | A fresh production token with `whatsapp_business_messaging` and access to the Renova WhatsApp account |
| `WHATSAPP_PHONE_NUMBER_ID` | `1300414879830376` |
| `WHATSAPP_REMINDER_TEMPLATE` | `renova_delivery_update` |
| `WHATSAPP_TEMPLATE_LANGUAGE` | `en` |
| `WHATSAPP_GRAPH_API_VERSION` | `v25.0` |
| `WHATSAPP_APP_SECRET` | App Secret for Renova Customer Updates |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | A random value also entered in Meta webhook setup |
| `REMINDER_CRON_SECRET` | A different random value shared with the reminder Worker |
| `APP_URL` | `https://shoprenova.com.ng` |

Revoke the access token previously exposed in a screenshot and use a replacement for production. Generating a new token does not itself prove the old token was revoked. Enter secrets only in private Terminal/provider settings.

Generate each random value separately on your Mac:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The four template parameters remain first name, order number, update paragraph and delivery estimate. Test-only order numbers and test wording are not used. A separate confirmation template is unnecessary.

## Meta webhooks

Open [Renova Customer Updates](https://developers.facebook.com/apps/2522770781522065/dashboard/), app ID `2522770781522065`, and its WhatsApp production setup for **+2347083380584**.

After the new route is deployed and environment values are saved:

1. Set Callback URL to `https://shoprenova.com.ng/api/whatsapp/webhook`.
2. Set Verify Token to the same `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, then verify/save.
3. Subscribe the real Renova WhatsApp account/app to **messages** events, including incoming messages and delivery receipts.
4. Complete the app's publishing/production requirements. Your earlier screen warned that unpublished apps would not receive actual production webhook data. A successful outbound test does not establish that STOP works.

The webhook verify token, App Secret and WhatsApp access token are three different values. The route checks POST signatures and the Phone Number ID. It handles receipts and opt-outs; it does not implement a conversational support bot.

## Scheduler

Update your existing Cloudflare reminder Worker using `deployment/renova-reminder-cron-worker.js`. Set its cron to `*/5 * * * *`. This checks every five minutes; it does not send each customer a message every five minutes.

Set `RENOVA_APP_URL=https://shoprenova.com.ng` and `REMINDER_CRON_SECRET` to the same private value as Render. The WhatsApp token belongs only on Render. The Worker calls `POST /api/orders/reminders/run` with the cron bearer secret; unauthenticated public requests cannot trigger a run.

For Wrangler, use the included `deployment/wrangler.reminders.jsonc`. If your existing Worker has a different name, put that name in the config first so you update the same Worker:

```bash
npx wrangler secret put REMINDER_CRON_SECRET --config deployment/wrangler.reminders.jsonc
npx wrangler deploy --config deployment/wrangler.reminders.jsonc
```

Use one scheduler. Overlapping checks are also guarded by database claims. Due messages can be later than 24 hours because of check intervals, server sleep/outages, backlogs or provider limits.

## Live website test

1. Finish webhook/publication setup, verify the template is active, and set `WHATSAPP_AUTOMATION_ENABLED=true` on Render.
2. Check out using your own number in the separate WhatsApp phone number field and review the update notice beside the order button. A payment-on-delivery test creates a real order record; identify it as QA and do not dispatch it. Paystack confirmation requires matching test/live payment settings and server-verified payment.
3. Confirm one message arrives with the order's actual data. In Admin → Reminders, use **Preview confirmation & daily update**. Enter new courier information only after verification.
4. **Save for next update** changes the daily message without sending immediately. **Save update & send now** and the Jumia arrival action deliberately send an extra update. Accepted manual WhatsApp sends move the daily deadline to at least 24 hours later.
5. Check the scheduled daily message after 24 hours. Local tests simulate this interval; they do not prove the live scheduler has run for a day.
6. Reply **STOP** from the recipient phone. Verify WhatsApp is disabled and pending messages are cancelled. Do not call the integration complete until a real STOP reaches the website.
7. Cancel the QA order in Admin → Orders. Mark delivered only if actual delivery/collection occurred.

## Delivery status and recovery

| Status | Meaning |
| --- | --- |
| `queued` | Waiting for setup, its deadline, backoff or a sender |
| `sending` | One server has claimed the provider POST |
| `accepted` | Meta returned a message ID; handset delivery is not confirmed |
| `sent`, `delivered`, `read` | Reported through signed Meta receipts |
| `failed` | Explicit rejection or delivery failure |
| `uncertain` | Timeout, interrupted sender or ambiguous provider result |
| `cancelled` | Stopped, opted out, superseded or no longer eligible |

Explicit transient rejections retry with backoff. After correcting failed credentials/template configuration, select **Retry WhatsApp message**. Uncertain sends do not retry automatically: check WhatsApp Manager and confirm non-delivery before retrying. Accepted messages without later receipts need webhook/subscription checks, not repeated sends.

Set `WHATSAPP_AUTOMATION_ENABLED=false` to pause outbound WhatsApp while keeping the webhook active for STOP. A code revert can restore the old sender's behavior, so remove its sending token if reverting while paused. Leave the additive migration in place to retain consent and delivery history.

The installer prints its backup location. Normal Git revert/review is available after committing. No code was pushed and no live database was changed during preparation of this package.

## Local verification

`npm run test:whatsapp` uses the actual queue, SQL, payment hook and webhook code against embedded PostgreSQL fixtures and a mocked provider. It covers separate checkout/WhatsApp numbers, automatic confirmation after order/payment verification, synchronous cart storage and one-time payment completion, concurrency, versioned consent, the daily interval, backlog coalescing, STOP, terminal orders, signatures, early/out-of-order receipts, retries and migration rollback. It does not connect to live Neon or send to a customer.

Existing TypeScript declarations for arrival-message drafts and Meta Pixel callbacks were also corrected so the full type check passes. The Pixel's runtime behavior is unchanged.

References: [Meta Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/), [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy), [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
