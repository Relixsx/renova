# Verification record and release checklist

## Current evidence

- Connected repository/branch rechecked: migration/neon-render at c1495a29c2ac80a9d76825d4054e4ae89896a715.
- Source objects were compared with their GitHub blob hashes before implementation.
- The local coding workspace disconnected during dependency installation. No successful local compile, automated test run, browser inspection, Docker build or real WhatsApp pairing is claimed.
- The feature includes automated tests and a GitHub validation workflow. The workflow outcome must be checked; test definitions alone do not count as passed.
- No production database connection or migration was attempted.
- No WhatsApp account was linked and no real message was sent.
- LIVE and bridge enablement default to false/OFF.

## Automated coverage

Run npm test:selligate, then the existing npm test suite. The new suite covers:
- All 37 state identifiers; Lagos and Abuja/FCT aliases; invalid/missing state.
- Explicit available/unavailable product rules, unconfigured defaults and independent product coverage.
- Mixed-product decisions, partial-message content, bundles and malformed/oversize inputs.
- OFF, fictional-only TEST, mocked LIVE, explicit confirmation and deployment latch.
- Actual PostgreSQL migration/trigger, order lifecycle, event deduplication and concurrent worker claims.
- Current availability recheck, emergency STOP, LIVE→OFF, TEST→LIVE, destination isolation.
- Disconnection, stale group/heartbeat, bridge instance leases and reconnect backlog cancellation.
- Known pre-send group failure, ambiguous send outcome, expired SENDING lease, persistent journal restart.
- Lost reporting responses, idempotent SENT outcomes and separate acknowledgement progression.
- HMAC tampering/expiry, durable nonce replay rejection, signed malformed requests and unauthorised endpoints.
- Existing payment/checkout/customer WhatsApp source preservation.

The existing regression suite also runs its customer confirmations/reminders, Aiven owner-auth/migration, checkout, product/admin source safeguards and production rendered Anagen pages.

GitHub CI uses PostgreSQL 18 with fictional data and disables external WhatsApp operation. It also checks both TypeScript projects and builds the bridge image. Review any dependency-lock artifact and commit the tested lock before release.

## Manual test-group checks — owner action, not yet performed

Keep SELLIGATE_LIVE_ALLOWED=false throughout.

1. Confirm the current Render deployed source and that existing orders, owner login, payments, confirmations and reminders still work.
2. Take and test-restore a private database backup; apply the isolated migration only after approval.
3. Confirm OFF/STOP on first load.
4. Verify an unauthenticated browser cannot view settings or pairing QR.
5. Start a single bridge; pair the dedicated authorised account.
6. Check the displayed number and separate test/production group IDs.
7. Configure a fictional test product's state coverage using an existing product; do not create a live artificial order.
8. Dry run while OFF: available state includes the item; unavailable state excludes it; nothing appears in WhatsApp.
9. Select TEST and explicitly request one fictional test. Confirm exactly one labelled message in the test group and none in production.
10. Inspect the returned message ID and later acknowledgements; do not interpret SENT as delivery to every group member.
11. STOP before requesting another test; confirm it cannot send.
12. Stop the bridge/network; reconnect; confirm STOP remains active and backlog is not replayed.
13. Restart while a controlled test send is in progress. Any ambiguous attempt must be UNCERTAIN, not automatically resent.
14. Change modes and group destinations while a TEST job is queued; confirm the immutable TEST job cannot reach production.
15. Remove sending permission or group membership; confirm a visible safe failure without redirecting.
16. Verify manual preview/copy and recording of a manual fulfilment request.
17. Confirm the mobile owner console fits, forms are labelled, and the emergency STOP is easy to reach.
18. Return to OFF and keep LIVE disabled until separate owner approval.

Do not tick these steps without observing the result. Do not use the real Selligate group as an automated test destination.

## Before release

- Automated workflow is green for the exact commit being deployed.
- A validated bridge dependency lock is committed and image built from it.
- Browser review at desktop and mobile widths is complete.
- Backup and rollback-detach procedure is rehearsed on a disposable database.
- Real test-group checks above pass with the authorised account.
- The owner verifies Selligate group membership and agrees the delivery-data sharing arrangement.
- Privacy notice changes are reviewed and deployed with the feature.
- Monitoring, encrypted storage, secret rotation and session revocation are in place.
- Owner explicitly authorises enabling LIVE. Until then remain OFF.
