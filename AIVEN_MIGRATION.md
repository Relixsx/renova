# Move Renova to Aiven, with the pending Anagen page

The initial restore succeeded on 16 November 2026. It contains 104 orders,
54 products, 18 categories, 120 reviews, saved reminders and WhatsApp history.
Every one of the 10 store table counts and the next-ID sequences matched.
That 9.4 MiB database is a staging copy of the 14:06:37 Nigeria-time snapshot.
The live website still uses Neon. Orders or receipts saved afterward need the
fresh final copy described below.

This combined update includes the pending Anagen page and replaces the app's
Neon-only database connection with native PostgreSQL. Aiven owner sign-in uses
Better Auth inside Aiven, so it does not depend on Neon Auth. Existing public,
checkout, reminder, message-editing and tracking features are retained.

Follow these stages in order. The installer changes local source only. The
preparation scripts never edit Render, push GitHub or send customer messages.
Keep connection strings, passwords, backup archives and certificates private.

## 1. Apply the combined update on your Mac

Extract `renova-aiven-update-20261116.zip` in Downloads. Then run:

```bash
bash "$HOME/Downloads/renova-aiven-update/apply-renova-aiven.sh" &&
cd "$HOME/Documents/Renova_Store" &&
npm ci --include=dev --legacy-peer-deps &&
npm run test:whatsapp &&
npm run test:migration &&
npx tsc --noEmit --incremental false &&
npm run verify:cumulative &&
npm run build &&
npm run test:production &&
git diff --check
```

The installer accepts the latest 28 October store and the known pending
Anagen update, including an Anagen update applied locally but not committed.
It checks file hashes first and refuses unknown changes. Replaced files are
backed up under `.git/renova-aiven-backups/`. Generated `tsconfig.tsbuildinfo`
is left alone. An already-applied update is safe to run again.

Do not run the older Anagen installer or its old Neon-only instructions after
this combined update. Product setup is included in final preparation below.
No existing store migration needs to be reapplied; do not run `db:push`.

## 2. Deploy the migration-capable app, still on Neon, in maintenance

In your EXISTING Render `renova` web service, retain the current Neon
`DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, owner emails,
and working payment, email, WhatsApp and Cloudinary settings.

Add these settings:

| Setting | Value |
| --- | --- |
| `APP_URL` | `https://shoprenova.com.ng` |
| `RENOVA_MAINTENANCE_MODE` | `on` |
| `MIGRATION_CONTROL_SECRET` | A new private random secret, generated below |

Generate the migration-control secret on your Mac and paste it directly into
Render. This copies it without printing it:

```bash
openssl rand -hex 32 | pbcopy
```

Set Render's build command to:

```text
npm ci --include=dev --legacy-peer-deps && npm run build
```

Set its start command to `npm start` and health-check path to `/api/health`.
Use a Node runtime with Node.js 22.13 or newer and one app instance. This app
now runs as native Next.js on Node so it can use Aiven's PostgreSQL connection.
Do not use the old Worker/Vinext server start command for this deployment.
The separate Cloudflare reminder Worker stays as it is.

Review `git diff`, then commit and push yourself:

```bash
cd "$HOME/Documents/Renova_Store" &&
git diff --check &&
git add -- app db next.config.ts proxy.ts package.json package-lock.json public/anagen scripts tests AIVEN_MIGRATION.md ANAGEN_SETUP.md &&
git commit -m "Move Renova to Aiven and add the Anagen landing page" &&
git push origin migration/neon-render
```

If the commit succeeds but the push has a network error, retry only
`git push origin migration/neon-render`; do not create the same commit again.

Wait until this exact new commit is fully **Live** on Render and the previous
instance has stopped. Maintenance pauses public ordering, admin store changes
and scheduled customer sends. Paystack and Meta callbacks receive retryable
503 responses. Owner sign-in, read-only admin pages and health remain available.
A flag on the old app alone cannot prove a freeze; the next tool verifies the
new app's revision and writer protocol. Close other local development servers
and do not run other database-writing scripts during the migration.

## 3. Make the final fresh copy and prepare your Aiven owner

Run from the updated repository:

```bash
cd "$HOME/Documents/Renova_Store" &&
bash scripts/prepare-aiven-final.sh
```

It privately asks for:

1. The same `MIGRATION_CONTROL_SECRET` saved in Render.
2. The CURRENT Neon store connection string.
3. The Aiven Service URI for `defaultdb`, with its real password.
4. The downloaded Aiven project CA certificate, selected in a file picker.
5. Your approved owner email and a new owner password, entered twice.
6. The actual available Anagen stock, counted in packs; enter 0 if unavailable.

This script checks the live freeze, then holds an exclusive PostgreSQL advisory
lock until the fresh backup, restoration and preparation finish. App writers
use the corresponding shared lock, so in-flight writes and awaited messages
must finish before the snapshot starts. The script creates a NEW final Aiven
store database, verifies every saved store count and sequence, adds the private
owner tables, tests owner sign-in, and sets up Anagen without overwriting an
existing Anagen product or its owner edits.

The new password is for the Aiven owner account. Existing Neon passwords and
sessions are not transferred. The original login records remain in the private
backup. The first approved owner is created here; another approved owner can be
added later with the private tool in the recovery section.

On success, the script prints `FINAL AIVEN DATABASE PREPARED AND OWNER LOGIN
VERIFIED`, its FINAL database name and matching order counts. It saves
`aiven-ready.json` beside the new private backup. The FINAL `DATABASE_URL` is
copied to your clipboard; paste it straight into Render next. It is not printed
or saved to that preparation record. Do not use `defaultdb` or the older initial
staging database for the app.

If anything fails, leave maintenance on and share the error summary, without
credentials. Render still uses its configured database; the tool does not
switch it.

## 4. Point Render at the verified FINAL Aiven database

Keep `RENOVA_MAINTENANCE_MODE=on` throughout this stage.

| Setting | Value |
| --- | --- |
| `DATABASE_URL` | Paste the FINAL URI from the preparation tool's clipboard |
| `DATABASE_SSL_CA` | The complete Aiven project CA certificate PEM |
| `BETTER_AUTH_SECRET` | A DIFFERENT new private random secret |
| `APP_URL` | `https://shoprenova.com.ng` |
| `ADMIN_EMAILS` | Keep the approved owner emails, including the one just created |

To copy the certificate without printing it, AFTER pasting `DATABASE_URL`:

```bash
cd "$HOME/Documents/Renova_Store" &&
bash scripts/copy-aiven-ca.sh
```

Paste the complete clipboard value into `DATABASE_SSL_CA`. Then create the
separate owner-auth secret and paste it into `BETTER_AUTH_SECRET`:

```bash
openssl rand -hex 32 | pbcopy
```

Keep that owner-auth secret stable after migration. Changing it invalidates
existing signed sessions. Aiven TLS verifies the project CA and server hostname;
do not disable certificate verification or use `NODE_TLS_REJECT_UNAUTHORIZED=0`.

Save/redeploy Render and wait for the new deployment to be fully Live. Then:

```bash
cd "$HOME/Documents/Renova_Store" &&
bash scripts/check-aiven-live.sh
```

Enter the migration-control secret privately. Confirm:

- Provider is `aiven`, mode is `on`, and migration revision is `aiven-20261116-v1`.
- The database name exactly matches the FINAL preparation output.
- Its order count matches the final source count and owner tables are present.

Open `https://shoprenova.com.ng/admin/login`. Sign in with the owner email and
new Aiven password. Confirm your orders, products, reminder states, editable
wording and saved delivery dates while maintenance still prevents mutations.
Do not reopen if these checks fail. Keep the old Neon database and the private
backups until the new system has been checked successfully.

## 5. Recover callbacks, then reopen

First change `RENOVA_MAINTENANCE_MODE` to `webhooks`, save/redeploy and wait for
Live. This admits only the signed Meta and Paystack retry callbacks. Checkout,
admin writes and scheduled reminders stay paused. Check Render logs, payment
statuses and WhatsApp delivery/opt-out records as provider retries arrive.
Retry timing belongs to the providers; changing the mode does not force an
immediate replay of every callback. Check any payment made close to the freeze
before reopening. A STOP received during maintenance must be reflected before
scheduled sends resume.

Then set `RENOVA_MAINTENANCE_MODE=off`, save/redeploy and wait for Live. Re-run
`check-aiven-live.sh`, check the storefront and `/anagen`, owner access and order
tracking. Confirm the Cloudflare Worker resumes its existing authenticated cron
calls. Restored delivery history and suppression rules prevent re-enrolling old
orders or replaying a backlog of daily messages. Automatic messages continue
only for eligible active orders at the existing 24-hour interval.

Do not switch traffic back to an old Neon copy after taking new Aiven orders:
that would omit the new orders. If verification fails before reopening, leave
maintenance on and diagnose the final database and deployment first.

## Owner password recovery and additional owners

The sign-in page has password recovery. It uses the existing Resend account
with `RESEND_API_KEY` plus `RESEND_FROM_EMAIL` or `ORDER_FROM_EMAIL`. Reset links
expire after 15 minutes, work once, and revoke the owner's existing sessions.
Public sign-up is disabled; only `ADMIN_EMAILS` accounts can administer Renova.

A private Mac fallback is available if email recovery is unavailable:

```bash
cd "$HOME/Documents/Renova_Store" &&
bash scripts/setup-aiven-owner.sh --reset-password
```

It prompts for the FINAL Aiven STORE URI, CA file, approved email and replacement
password. It revokes that owner's existing sessions and verifies the new login.
It never changes store records or sends customer messages. To add the second
approved owner, run the same script without `--reset-password`. Default approved
emails are `relixsx@gmail.com` and `airebirth5@gmail.com`; if Render uses a custom
`ADMIN_EMAILS`, set the same list in Terminal before running this optional tool.
Only prepare accounts you actually want to authorize.

## Operational notes

The app uses at most four store connections plus one separate owner-auth
connection per Node process. A rolling deployment with two processes can use
up to ten. Leave the rest of Aiven's 20 connections available for PostgreSQL
maintenance and migration tools; do not add app instances without reviewing
this budget. This is a simultaneous connection limit, not a count of customers.

The current store is much smaller than the service's 1 GB storage allowance.
Free hosting still has capacity and inactivity rules; migration is not a
promise that every future workload or provider policy will stay free. Maintain
private backups. The existing `/api/health` check does not query the database.
No change to WhatsApp templates, language settings, email addresses or Worker
schedule is part of this migration.

Validation delivered with this update covers real owner authentication against
an embedded PostgreSQL engine, session revocation, password recovery, rate
limits, writer-drain isolation, maintenance, current checkout/reminder behavior,
and native production rendering. Those local checks do not replace the live
Aiven TLS/login and final Render checks above. No customer message is sent by
the local tests or migration preparation.
