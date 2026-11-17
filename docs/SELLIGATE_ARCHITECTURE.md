# Implementation and operating decisions

## Order lifecycle and boundaries

The current checkout initialisation route inserts payment_pending before opening Paystack. A successfully placed COD order is inserted as confirmed. The existing paid-order workflow changes a pending order to processing. Dispatch therefore observes the existing confirmed/processing lifecycle through an additive PostgreSQL AFTER trigger, rather than modifying checkout or payment files.

The trigger never reads payment status, method or amount and introduces no payment eligibility rule. It inserts a unique order-event tombstone and, only while LIVE and not stopped, a durable job in the same transaction as the order lifecycle event. A duplicate transition cannot create another dispatch. Old orders are not scanned or backfilled.

Checkout never waits for WhatsApp, Puppeteer or a network call to the bridge. The SQL trigger does a bounded database insert; if that atomic database transaction fails, the order transition fails rather than silently claiming a dispatch was queued.

No Paystack, existing customer-confirmation, WhatsApp template, webhook, reminder or Cloudflare cron source is changed. The preservation test hashes the audited versions.

## Eligibility

Rules key to existing product IDs, joined to current product slugs. The states are the exact ng-geo-data conventions already used by checkout. There are 37 explicit locations. Missing rules, empty rules, invalid state and missing state all exclude an item.

Every line is evaluated independently. Only included items enter the message. A mixed result is explicitly a partial fulfilment request. The server re-evaluates availability at send authorisation, after the claim. It never derives delivery state from a phone prefix, city or billing field. An explicit invalid state code does not fall back to a different name.

Malformed orders fail for owner review. Long messages are not truncated or split into multiple independently actionable fulfilment requests.

## Durability and duplicate control

- Transactional order event + LIVE job, unique per order.
- TEST records contain generated fictional fixtures only, never real customer-order copies.
- Settings-row locks serialise mode/STOP changes and worker authorisation.
- FOR UPDATE SKIP LOCKED plus claim token/lease prevents concurrent claims.
- Job mode, destination and settings generation are immutable routing context.
- Destination changes, mode changes, STOP and connection recovery invalidate queued/claimed work.
- SENDING is committed before the bridge can call WhatsApp.
- A final authenticated server permission check occurs immediately before the WhatsApp call.
- Expired SENDING becomes UNCERTAIN. A sender failure after authorisation is also conservative UNCERTAIN.
- SENT stores a returned message ID; separate acknowledgement rows record server/device/read events.
- A persistent SQLite journal is written synchronously before the browser call. It prevents a restarted bridge from repeating an authorised attempt and retries missing outcome reports instead.
- Confirmed local sends remain duplicate-prevention tombstones. Test payloads and completed item decisions expire after 30 days; routine audit/ack history expires after 90 days. The main store retains its own existing order records.

There is an unavoidable distributed boundary between the last STOP check and an external WhatsApp send. STOP prevents new initiation after it is observed; it cannot recall an external request already started. Exactly-once messaging is not promised.

Any connection restart, lost control lease, disconnection, or reported control-channel recovery activates STOP. Resuming affects new work only. Backlog retry is an explicit per-job owner decision.

## Authentication and network design

The bridge initiates outbound HTTPS requests to one fixed Renova origin. No public WhatsApp-sending HTTP endpoint exists on the bridge.

The HMAC covers protocol version, HTTP method, exact path, millisecond timestamp, nonce and SHA-256 body hash. The server uses constant-time comparison, a 30-second clock window and a durable unique nonce ledger. Nonces are consumed before business processing, including rejected commands. Active bridge instances also need the server connection lease.

Owner configuration and private QR requests reuse the existing Better Auth/owner allowlist and same-origin write validation. API responses are no-store/private. Secrets stay on the server/bridge. Group IDs must have group syntax, be separately selected, differ across TEST/LIVE, and match recently observed membership and send capability. The worker and bridge both check the original selected destination. Ordinary phone-number destinations are rejected.

LocalAuth is a full linked-device browser profile. Although no personal-message handlers, chat viewer or contact export is built, the profile can contain account history. Use a dedicated authorised account and encrypted persistent storage.

## Infrastructure

The existing Aiven pool is reused by the app; there is no extra permanent PostgreSQL pool in the bridge. Database transactions are short and released after requests. The bridge keeps one long-running Chromium instance on a persistent volume. It maintains a filesystem lock plus a server lease; multiple replicas are unsupported.

The Node 24 image runs non-root, uses Chromium's sandbox and private volume permissions, and has no public inbound port. The example grants SYS_ADMIN for sandbox compatibility and belongs on an isolated host. Production image and dependency-lock validation remain required before release.

## Primary references checked on 17 November 2026

- Library version and API: https://docs.wwebjs.dev/ (1.34.8), https://docs.wwebjs.dev/Client.html, https://docs.wwebjs.dev/GroupChat.html
- Persistent LocalAuth, including browser-history caveat: https://wwebjs.dev/guide/creating-your-bot/authentication.html
- Unofficial-client/blocking warning: https://wwebjs.dev/guide/
- Acknowledgement types: https://docs.wwebjs.dev/global.html#MessageAck
- Coexistence and linked-device limitations: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/
- Persistent hosting: https://render.com/docs/disks and https://render.com/docs/free
- Chromium sandbox/container requirements: https://pptr.dev/guides/docker

whatsapp-web.js is unofficial. It can break when WhatsApp Web changes, and its use may result in account restrictions. No evasion techniques are included. A successful mocked test does not establish that WhatsApp will permit the deployment. The manual fulfilment fallback remains necessary.
