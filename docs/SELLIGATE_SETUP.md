# Renova × Selligate dispatch

Status: implementation branch, not a production release. Automation defaults to OFF with emergency STOP active. No production database migration, WhatsApp pairing, real-group test, or LIVE activation has been performed by this implementation.

## Audited source

Repository: https://github.com/Relixsx/renova
Deployment branch shown in the supplied Render screenshots: migration/neon-render.
Latest connected branch head rechecked on 17 November 2026: c1495a29c2ac80a9d76825d4054e4ae89896a715, “Update Renova storefront and maintenance features”.
The implementation branch is feature/selligate-dispatch, based on that commit. Its parent preserves the pre-feature source, including the gold /anagen and lime /anagen2 pages. The Render deployed commit could not be independently read; verify it before merging.

The application currently uses native Next.js 16 / React 19 on Render, pg + Drizzle for Aiven PostgreSQL and Better Auth owner sessions. The earlier Cloudflare/Vinext build remains in the repository. The existing reminder cron and Meta Cloud API integration are separate and unchanged.

Read implementation and validation details in SELLIGATE_ARCHITECTURE.md and SELLIGATE_VERIFICATION.md.

## What the owner will control

After deployment and migration, open /admin/selligate from the existing owner console.

1. OFF: no sending jobs from customer orders, no sends. Offline simulations still work.
2. TEST: only a fictional test explicitly requested by the owner can enter the TEST queue. Actual sending is to the selected test group only.
3. LIVE: only new placed-order events enter the LIVE queue. Every item must be available in its own product configuration for the customer's delivery state.
4. STOP: cancels queued/claimed jobs and blocks send permission. An already-initiated external send cannot be recalled.
5. Reconnect: requires the owner to resume new dispatches. Cancelled backlog is never automatically replayed.

Do not enable LIVE as part of initial setup.

## Runtime requirements

- Existing Renova application and verified Aiven database.
- Node 24 for the separate bridge; Renova retains its existing Node requirement.
- One always-on Linux VPS or dedicated paid service with persistent disk, Docker Compose and Chromium sandbox support.
- An authorised dedicated WhatsApp Business app account. Do not repurpose the existing Cloud API number.
- Two distinct ordinary WhatsApp groups: an owner-controlled fictional-test group and the real Selligate group.
- HTTPS from bridge to Renova. The bridge has no public send endpoint and exposes health only on loopback.
- One bridge instance. Persistent volume permissions are private, with an additional filesystem lock and server connection lease.

Render's free web filesystem is not a persistent session store. An ordinary Cloudflare Worker is not the host for this bridge. Keep the reminder Worker as it is. A web app that sleeps or cold-starts can cause safe dispatch pauses; use an always-on app for reliable LIVE operation.

## 1. Review and test the source

Check out feature/selligate-dispatch, with an up-to-date migration/neon-render parent. Preserve any uncommitted owner edits before switching branches.

    npm ci --legacy-peer-deps --ignore-scripts
    npm ci --prefix bridge --ignore-scripts
    npm run check --prefix bridge
    npx tsc --noEmit
    npm test

The existing root lockfile needs legacy-peer-deps because legacy Neon Auth dependencies have conflicting peer requirements. No authentication dependency was upgraded by this feature.

The bridge dependency lock is committed. It was generated and used by GitHub validation with whatsapp-web.js 1.34.8 and Puppeteer 24.38.0. Use npm ci --prefix bridge --ignore-scripts for repeatable installs. The final commit must still pass its own validation before release.

Tests use fictional customers and mocked WhatsApp calls. To exercise actual concurrent PostgreSQL transactions, use the isolated CI PostgreSQL 18 service or set SELLIGATE_TEST_DATABASE_URL to a disposable database named selligate_test on localhost. The suite refuses a remote/non-test database. With no test URL it uses PGlite for offline checks.

## 2. Source and database backup

The audited source is preserved at c1495a29c2ac80a9d76825d4054e4ae89896a715. You can make a local archive:

    git archive --format=tar --output=../renova-before-selligate.tar c1495a29c2ac80a9d76825d4054e4ae89896a715

No production database backup has been taken by this implementation: production credentials and runtime access were not supplied.

Before installing the migration, use PostgreSQL 18 tools and your existing private database configuration. Keep connection strings and CA certificates out of chat and Git. For example, if the existing private .env.local contains the verified DATABASE_URL and DATABASE_SSL_CA:

    node --env-file=.env.local scripts/selligate/backup.mjs

The script reads the database, creates a private custom-format archive, checks the archive directory and full archive decoding, and writes a SHA-256 manifest. It does not restore or alter the database. Test-restore the archive to a separate disposable PostgreSQL service before relying on it for disaster recovery.

## 3. Install the additive migration

Review db/selligate/001-dispatch.sql. It creates an isolated selligate schema and a small AFTER order-status trigger. It does not rewrite existing orders, payment code, product records, or owner accounts, and it does not backfill historical orders.

Only after the owner approves the maintenance action and the backup is verified:

    SELLIGATE_APPLY_MIGRATION=yes node --env-file=.env.local scripts/selligate/migrate.mjs /absolute/private/backup-folder

The migration requires a matching database backup from the past 24 hours and verifies its hash. All DDL is in one transaction. A second installation attempt refuses to reset existing settings. Initial settings are OFF and STOPPED.

Do not rerun the old Neon-to-Aiven migration or Anagen product setup.

## 4. Application environment

Keep existing database, authentication, payment and customer-notification variables unchanged.

| Variable | Value / purpose |
| --- | --- |
| SELLIGATE_BRIDGE_KEYS | Private JSON key map, e.g. {"primary":"YOUR_PRIVATE_RANDOM_SECRET"} |
| SELLIGATE_LIVE_ALLOWED | false during setup and fictional tests |
| SELLIGATE_VALIDATED_BUILD | Leave empty until the automated suite has passed; then selligate-v1 |

Generate a long random bridge secret privately, for example with openssl rand -hex 32. The same value goes into the bridge environment. It must never be put in browser JavaScript.

SELLIGATE_VALIDATED_BUILD is a deployment assertion about the tested release, not a substitute for account pairing or a real test-group check. The dashboard shows those separately.

The existing migration maintenance mode still takes precedence over new endpoints. Finish the existing Aiven migration/reopening procedure if maintenance is still enabled. Do not change it merely to bypass a Selligate setup issue.

## 5. Bridge setup

For the existing AWS Free account and an Ubuntu Lightsail or EC2 instance, follow [SELLIGATE_AWS.md](SELLIGATE_AWS.md) first. The preparation helper builds and checks the pinned bridge without starting it. Continue the backup, migration and OFF setup here before pairing.

On the isolated host, check out this implementation and use the tested dependency lock:

    cp bridge/env.example bridge/.env

Edit bridge/.env privately:

- RENOVA_URL=https://shoprenova.com.ng
- SELLIGATE_BRIDGE_ENABLED=false initially.
- SELLIGATE_BRIDGE_KEY_ID=primary
- SELLIGATE_BRIDGE_SECRET=the same private secret configured in Renova.

Set file permissions to 600. Never commit .env or the /data volume.

    docker compose -f bridge/compose.yaml build
    docker compose -f bridge/compose.yaml up -d
    docker compose -f bridge/compose.yaml ps

The image runs as a non-root user and Chromium keeps its sandbox. The compose definition grants SYS_ADMIN for browser sandbox compatibility; this is a broad capability, so use an isolated host and review the runtime configuration. Do not add account-evasion or anti-detection options. Do not mount unrelated host files.

A healthy heartbeat confirms communication with Renova. It does not mean WhatsApp is paired. If the process or network fails, the backend expires the connection lease and pauses dispatch.

## 6. Pair the authorised account

After the bridge is running correctly:

1. Set SELLIGATE_BRIDGE_ENABLED=true on the bridge and restart that service.
2. Sign in to Renova as an approved owner and open Selligate automation.
3. Click “Link / reconnect account” and confirm that you own the dedicated number.
4. Scan the private temporary QR in WhatsApp → Settings → Linked Devices → Link a device.
5. Confirm the connected number displayed in the console matches the intended dedicated account.
6. Keep automation OFF until group configuration is complete.

QRs expire, are returned only to the authenticated owner, are never logged or committed, and are cleared after expiry. LocalAuth persists a linked browser profile under the private volume. That profile can contain WhatsApp chat history even though this application does not read/display personal conversations. Treat the whole volume as account credentials: encrypted storage, restricted host access, encrypted private backups.

Do not pair an API-only number. Meta supports a specific Business app/Cloud API coexistence onboarding flow; that does not establish that this existing Renova number is compatible with an unofficial client. No Cloud API registration, deregistration or account migration is performed here.

## 7. Choose the groups and coverage

- Join both groups using the dedicated WhatsApp account.
- Refresh groups in the console. Only group name, stable ID and sending capability are shown.
- Select a separate test group and the real production group. Their IDs must differ.
- Verify Selligate's actual group ID with the owner; never rely on the name alone.
- Save destinations. This activates STOP and invalidates old queued jobs.
- Select each product and explicitly mark its available states. No coverage is guessed or prefilled.
- Abuja/FCT uses the application's existing FC code; Lagos uses LA.

If group permissions or membership change, dispatch fails safely. No fallback group is substituted.

## 8. Fictional testing

1. Leave SELLIGATE_LIVE_ALLOWED=false.
2. Preview an available-state and unavailable-state simulation while OFF.
3. Select TEST and verify the test group destination.
4. Resume new dispatches if stopped.
5. Click “Send fictional test only” and confirm.
6. Verify the single fictional message in that test group and inspect its message ID/acknowledgements.
7. Run the STOP, disconnect, restart and duplicate checklist in SELLIGATE_VERIFICATION.md.
8. Return to OFF after testing.

Do not insert artificial orders into the production orders table. The test laboratory uses a separate fictional fixture and dispatch record.

## 9. Later owner-authorised LIVE activation

This step is not authorised or performed by the implementation.

After successful automated and real test-group verification, the owner may set SELLIGATE_VALIDATED_BUILD=selligate-v1 and SELLIGATE_LIVE_ALLOWED=true on the tested Renova release. In the authenticated owner console, select LIVE and type ENABLE LIVE DISPATCH. Verify the production group and product coverage first.

This enables only future placed-order events. It does not replay orders received while OFF or stopped. Owner approval is audited. Changing the destination clears prior LIVE approval and activates STOP.

## Monitoring and manual fallback

Check the dashboard for fresh heartbeats, expired group validation, failed jobs and UNCERTAIN outcomes. The bridge's /healthz is loopback-only. Docker health status is visible through compose ps; configure your host monitoring to alert on unhealthy status.

SENT means a stable WhatsApp message ID was returned, not that all group participants received/read the message. Acknowledgements are shown separately and may be incomplete for a group.

For a failed or uncertain request:
- Search the actual destination group for its dispatch reference before doing anything.
- If it is already present, record manual fulfilment/reconcile it; do not retry.
- If definitely absent, the owner can explicitly authorise a retry to the original group in the original mode.
- A locally confirmed send cannot be repeated by the bridge, even if the backend report was lost.
- Use View / copy for a private message preview, manually send to the authorised group if needed, then Record manual send.
- If automation is OFF and no job exists, use the existing Orders workspace and evaluate the product's configured coverage manually.

The system never guarantees exactly-once delivery across WhatsApp and PostgreSQL. Its conservative ambiguity handling deliberately prefers owner review over duplicate fulfilment.

## Stop, revoke, rotate and roll back

Emergency STOP immediately blocks fresh authorisations and cancels queued/claimed work. An external call already initiated may finish. To enforce a host-level stop, stop the bridge container as well.

Disconnect & revoke requests WhatsApp logout and removes the local authentication profile. If remote logout cannot be confirmed, remove the linked device directly in WhatsApp; deleting local files alone does not prove remote revocation.

For key rotation, add a new key ID to SELLIGATE_BRIDGE_KEYS, update the bridge key ID/secret, restart it, verify the heartbeat and explicitly resume, then remove the old server key. Do not log either key.

For code rollback:
1. Set OFF, activate STOP, stop the bridge and revoke the linked device if abandoning the feature.
2. Verify a fresh private backup.
3. Run the detach command; it preserves all store data and dispatch history:

    SELLIGATE_APPLY_MIGRATION=yes node --env-file=.env.local scripts/selligate/migrate.mjs /absolute/private/backup-folder --detach

4. Deploy the preceding Renova application commit. The detached schema can remain for audit/history.
5. Do not drop schemas or restore an old whole-store backup over newer customer orders merely to roll back this feature.

Reattaching requires reviewing the capture trigger definition; do not rerun the initial migration against an existing selligate schema.
