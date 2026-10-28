# Find and stop running reminders

28 October 2026. This update includes the three-message workspace and adds reminder-status filters. Install over either the 27 October simple-reminders update or the 28 October message-workspace update on `migration/neon-render`. Database migration 0007 is already part of those installed updates. No additional database migration, dependency, environment variable, Meta template or Worker change is required.

## Find an order

Open **Admin → Reminders**. The page starts with **Running** selected.

| Filter | Orders shown |
| --- | --- |
| Running | Orders with an active saved schedule, including daily delivery and arrival reminders |
| Stopped | Orders whose reminders were previously started and then stopped |
| Not started | Orders that have never started reminders, including saved message drafts only |
| All | Every order in the admin list |

Each filter shows its total. Search by order number, name, delivery phone, recorded WhatsApp phone or email within the selected group. Counts remain the group totals while the result line shows how many match your search. Clear the search to see the whole group.

Running follows the saved schedule across WhatsApp, email and SMS. Stopping WhatsApp alone can leave email or SMS running, so that order remains under Running. Delivery failures or provider configuration do not turn an active schedule into a stopped one. Individual message outcomes remain under each order's delivery results.

Past orders with an active schedule remain visible under Running, even if their order status is completed, so you can find and stop those schedules. Viewing or filtering the list sends nothing and changes no settings.

The order-page reminder workspace has the same filters, with All selected initially so you can also find orders that have not started yet.

## Stop a past order

1. Select **Running** and find the order.
2. Select **Stop all reminders** in its header.
3. The schedule is stopped for that order and queued WhatsApp messages are cancelled. A confirmation offers **View stopped reminders**.

The order moves into Stopped after the server confirms the change. Other orders keep their settings. Saved wording, delivery dates, collection information and channel selections remain available. If stopping fails, the order remains under Running with an error. A successful stop remains visible even if the following status refresh fails.

The existing **Stop WhatsApp notifications** control remains for a WhatsApp-only pause. Restarting still requires an eligible order, verified payment where applicable, and customer agreement. Customer STOP requests cannot be overridden. Completion and arrival-verification rules are unchanged.

## Install and check

Download and unzip **renova-full-message-editor-20261028.zip** in Downloads. It extracts **renova-full-message-editor**. Use this ZIP for the next install; it also contains the visible daily/arrival editors and all three message tabs.

```bash
bash "$HOME/Downloads/renova-full-message-editor/apply-renova-full-message-editor.sh" &&
cd "$HOME/Documents/Renova_Store" &&
npm run test:whatsapp &&
npx tsc --noEmit --incremental false &&
npm run verify:cumulative &&
git diff --check
```

The installer verifies the branch and source hashes, requires a clean repository, backs up affected files inside Git metadata, and rolls back a failed application. It refuses unknown committed changes. If only the generated `tsconfig.tsbuildinfo` cache is modified, `git restore -- tsconfig.tsbuildinfo` restores that cache; preserve other edits.

## Commit and push after checks pass

```bash
cd "$HOME/Documents/Renova_Store" &&
git diff --check &&
git add -- app scripts/test-whatsapp.mjs tests CHECKOUT_UPDATE.md FULL_REMINDER_MESSAGE_EDITOR.md REMINDER_STATUS_FILTERS.md ORDER_MESSAGE_WORKSPACE.md SIMPLE_DELIVERY_REMINDERS.md JUMIA_DELIVERY_COUNTDOWN.md REMINDER_MESSAGE_EDITOR.md WHATSAPP_SETUP.md WHATSAPP_ORDER_CONTROLS.md REMINDER_BOT_SETUP.md &&
git commit -m "Improve WhatsApp message editing and checkout notices" &&
git push origin migration/neon-render
```

Wait for this commit to show **Live** on Render, refresh the admin page, then open **Reminders**. Downloading alone does not update the live website.

## Verification

123 regression tests cover existing WhatsApp, checkout, message and countdown safeguards plus reminder grouping, search totals, not-started drafts and an owner-authorized stop of a past arrival order. The stop test verifies cancellation, preserved settings and an unaffected running order using a local PostgreSQL-compatible fixture with provider requests blocked or mocked. Additional DOM checks exercise the actual React filter, search, stop, restart, loading and error paths using synthetic orders and mocked requests.

TypeScript, changed-source lint, source safeguards, production build and rendered HTML checks are run before packaging. Live browser appearance still needs the normal post-deployment check. No production database, customer messaging service, GitHub push or deployment is contacted by this installer.
