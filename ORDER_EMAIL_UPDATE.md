# Renova owner order emails

New order alerts go to **airebirth5@gmail.com** through Renova's existing
Resend HTTPS email connection. This replaces Formspree for owner alerts from
Anagen, the regular payment-on-delivery checkout and verified Paystack orders.
Customers still complete the order form on the website. Orders stay in the
same Aiven database and admin workspace, with the same WhatsApp integration.

## Why the supplied PHP sender is not installed

I inspected the original `process_order.php`. It uses PHPMailer, Gmail SMTP,
a sender login/app password, TLS and port 587. Changing its recipient would
still require that sender account and an available SMTP connection. The
current Render service uses Node.js; Render does not offer a native PHP
runtime, and free Render services block SMTP ports 25, 465 and 587.

The working update uses the existing server email API over HTTPS. It does not
copy the friend's SMTP password, run the original PHP/CSV checkout, or require
PHP hosting. If the literal Gmail/PHPMailer sender is required, it needs
compatible PHP hosting with SMTP access and your own sender credentials.
This ZIP is the compatible implementation for the current Render service.

Official provider references, checked 16 November 2026:

- https://render.com/docs/free
- https://render.com/docs/native-runtimes
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://resend.com/pricing

Resend's Free plan currently allows **100 emails per day and 3,000 per month**.
This removes the Formspree submission quota; it does not make email unlimited.
Owner alerts, customer confirmation emails and any daily email reminders on
the same Resend account share its quota. WhatsApp uses the separate existing
Meta integration.

## Apply locally

Extract `renova-order-email-update-20261116.zip` into Downloads. Run:

```bash
bash "$HOME/Downloads/renova-order-email-update/apply-renova-order-email.sh" &&
cd "$HOME/Documents/Renova_Store" &&
npm test &&
git diff --check
```

The installer expects the combined Aiven/Anagen update deployed as commit
`a9e12d4` on branch `migration/neon-render`. It checks existing source and
payload hashes before editing, backs up replaced files under
`.git/renova-order-email-backups/`, and preserves generated TypeScript state.
Unknown local source changes stop installation before any project file changes.
It is safe to repeat if the identical update is already applied.

There are no new dependencies, store migrations or product setup steps.
Do not repeat the database backup/restore or final-preparation tool for this
email update. Your final database remains
`renova_store_20261116t161546_97745c2e`.

## Required Render settings

Keep the existing working values:

- `RESEND_API_KEY`: your private Resend API key.
- `RESEND_FROM_EMAIL`: the sender address on your verified Resend domain.
  The existing `ORDER_FROM_EMAIL` name is also supported as a fallback.

The recipient is set in code to **airebirth5@gmail.com**. No recipient variable
or Gmail password needs to be added in Render. The sender and recipient are
separate: keep the verified sender address; the owner receives its messages at
the requested Gmail account. A new unverified Resend account may restrict
sending to its own account email until a sender domain is verified.

The old `FORMSPREE_ENDPOINT` may remain in Render during verification; this
update does not call it. No WhatsApp template, scheduler, payment secret,
Aiven connection or owner-auth secret changes are needed.

## Push and deploy yourself

After the local checks pass, review the diff and run:

```bash
cd "$HOME/Documents/Renova_Store" &&
git diff --check &&
git add -- app/lib/order-payment.ts app/lib/owner-order-email.mjs app/api/migration/status/route.ts scripts/check-aiven-live.mjs scripts/test-whatsapp.mjs scripts/test-aiven-migration.mjs tests/anagen.test.mjs tests/owner-order-email.test.mjs ANAGEN_SETUP.md ORDER_EMAIL_UPDATE.md &&
git commit -m "Send Renova order alerts directly to owner email" &&
git push origin migration/neon-render
```

Render auto-deploy was temporarily turned off for the database migration.
Use Render → renova → Manual Deploy → Deploy latest commit after the push.
Keep `RENOVA_MAINTENANCE_MODE=on` while applying and checking this update.
The same Node build/start commands and `/api/health` path continue to apply.

After the new commit is Live:

```bash
cd "$HOME/Documents/Renova_Store" &&
bash scripts/check-aiven-live.sh
```

Enter the existing migration-control secret privately. The output adds:

```text
Owner order email: airebirth5@gmail.com; configured: yes
```

That line checks whether the key and sender settings are present. It does not
send an email or prove API-key validity, domain verification or inbox delivery.
Use the live delivery check below once maintenance has been completed.

## Finish the current migration and view Anagen

The screenshot saying "We'll be back shortly" is the deliberate maintenance
screen from `RENOVA_MAINTENANCE_MODE=on`. The Anagen page is already deployed;
that screen is not a missing-page or email error.

Open https://shoprenova.com.ng/admin/login and sign in with
`relixsx@gmail.com` and the new admin password created during final Aiven
preparation. Check your orders, reminders and the Anagen product. The current
setup lists 1,000 Anagen packs. Verify actual availability before reopening;
one pack contains two sachets. If that count was a placeholder, report the
actual number so it can be corrected without opening checkout prematurely.

Follow stage 5 of `AIVEN_MIGRATION.md`: first deploy maintenance mode
`webhooks` to recover signed Meta and Paystack callbacks while scheduled
reminders and checkout remain paused. Check any payments and opt-outs close
to the freeze. After verification, deploy maintenance mode `off` to reopen.
The public page is https://shoprenova.com.ng/anagen.

## Email contents and delivery behavior

Owner messages include the order/tracking reference, customer name, optional
customer email, delivery phone, separate WhatsApp phone, alternative phone,
Today/Tomorrow availability, products and pack quantities, exact saved amount,
payment status, address and saved delivery estimate.

No customer-supplied field can change the owner recipient. Customer text is
escaped in HTML, valid supplied email is used only as Reply-To, and owner API
requests have a 15-second timeout. Errors exclude private API response bodies.

A separate idempotency key is used for each owner order alert. Resend retains
these keys for 24 hours. The existing checkout guards also prevent repeated
Anagen submissions from creating new orders or notification sets. This update
does not replay old order alerts, add an owner-email retry queue, or send daily
owner emails. An owner email failure leaves the order saved in Admin and does
not prevent its eligible WhatsApp confirmation. Check provider delivery logs
if an alert is missing.

## Live delivery check

The local tests use mocked providers and send no real email or WhatsApp.
After reopening, use your own contact details for one Anagen test order.
Confirm the exact bundle price and free shipping in Admin, the owner alert in
**airebirth5@gmail.com** (including Spam), and the existing WhatsApp confirmation.
If you provide a customer email, it receives its separate confirmation too.
Stop/cancel the test order afterward using the admin controls. Provider API
acceptance alone is not proof of arrival in an inbox or on a phone.
