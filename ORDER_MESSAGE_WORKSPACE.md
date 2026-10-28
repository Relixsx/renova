# Order confirmation, daily updates and arrival reminders

28 October 2026. This follows the installed 27 October simple-reminders update on `migration/neon-render`. No database migration, new dependency, API key, Meta template change, Worker change or Render environment change is required. Existing Jumia dates, custom wording, consent and schedules are retained.

## Install and check

Download `renova-message-workspace-20261028.zip` and unzip it in Downloads. It extracts a **renova-message-workspace** folder.

```bash
bash "$HOME/Downloads/renova-message-workspace/apply-renova-message-workspace.sh" &&
cd "$HOME/Documents/Renova_Store" &&
npm run test:whatsapp &&
npx tsc --noEmit --incremental false &&
npm run verify:cumulative &&
git diff --check
```

The installer checks the branch and affected source files, requires a clean repository, makes backups inside Git metadata, and rolls back an application failure. If only `tsconfig.tsbuildinfo` is modified, restore that generated cache using `git restore -- tsconfig.tsbuildinfo`; preserve other edits.

## The three tabs

Open an order under **Admin → Orders** or **Admin → Reminders**, then open **Delivery dates & automatic messages**.

| Tab | What it does | What you can change |
| --- | --- | --- |
| 1. Order confirmation | Automatic for new confirmed orders or verified prepaid payments | Review its own preview; daily edits never change or resend it |
| 2. Daily delivery update | Repeats on the existing 24-hour schedule | Edit the visible message field, Jumia dates, extra instructions and verified courier note |
| 3. Arrival & collection | Starts after explicit arrival verification | Edit its own visible message, collection information and instructions |

On wider screens the editing fields and customer preview sit in two columns. On smaller screens they stack. The previous nested wording and other-message menus are removed. Sending preferences and recent WhatsApp delivery results remain separate below the editor.

## Edit the daily message directly

Choose **2. Daily delivery update**. In the **Daily message** card, edit **Your message to the customer**. It is a real text field with ready-made wording already filled in. The separate **Message preview** shows the complete outgoing customer copy and is read-only.

Select **Save daily update** after editing. The customer's name, website order number, items, payment information, current order progress and countdown stay automatic. You do not need to insert name or countdown buttons or type a number of days into the wording.

Save daily and arrival edits separately. Saving one tab preserves any unsaved wording in the other tab. A dot on a tab marks unsaved edits. **Use store default wording** changes that tab's draft; save it to apply the reset.

Optional extra instructions, a verified courier note and the fallback estimate remain available. When Jumia dates are present, their exact window supplies the daily delivery line instead of the fallback. Select **Email** in the preview to reveal email subject/heading fields. SMS and WhatsApp keep their own previews.

## The countdown changes automatically

For a saved Jumia window of **6–10 November 2026**:

| Sending date in Nigeria | Days remaining |
| --- | --- |
| Wednesday 28 October | 9–13 days |
| Thursday 29 October | 8–12 days |
| Friday 30 October | 7–11 days |
| Saturday 31 October | 6–10 days |

The code subtracts the current Nigeria calendar date from each end of the expected window. It recalculates for every actual send, including a queued message that crosses midnight. It does not freeze the number at the time you saved the wording or use the original order date for today's remaining days.

The Jumia dates card also shows **Today** and **Tomorrow** so you can see the automatic change. The open editor refreshes its day at Nigeria midnight and when you return to the page. These are calendar days, including weekends. The existing full 24-hour interval between recurring WhatsApp sends is retained.

Within the window, wording changes to expected today or within the remaining days. After it passes, the message says arrival is not confirmed and the estimate has passed. Update the dates if Jumia supplies a revised window. Dates alone never start arrival messages.

## Arrival and store defaults

In **3. Arrival & collection**, edit the message and enter the verified collection point or arrival details. **Save arrival wording** saves without sending. To start arrival messages, check the courier-verification box and select **Confirm arrival and start arrival reminders**. If notifications are off, arrival is recorded and they stay off. STOP, completion and owner stop controls remain in effect.

**Admin → Reminders → Store message defaults** changes daily/arrival wording for orders without corresponding custom wording. Genuine existing custom messages are retained. Untouched defaults from earlier versions adopt the new plain wording without rewriting database records. The existing approved WhatsApp greeting and closing stay fixed; the preview includes the actual length limit and shortening used by the sender.

## Commit and push

After reviewing `git diff` and the passing checks:

```bash
cd "$HOME/Documents/Renova_Store" &&
git diff --check &&
git add -- app tests ORDER_MESSAGE_WORKSPACE.md SIMPLE_DELIVERY_REMINDERS.md JUMIA_DELIVERY_COUNTDOWN.md REMINDER_MESSAGE_EDITOR.md WHATSAPP_SETUP.md WHATSAPP_ORDER_CONTROLS.md REMINDER_BOT_SETUP.md &&
git commit -m "Organize order messages with visible daily and arrival editors" &&
git push origin migration/neon-render
```

Wait for the new commit to show **Live** on Render, then refresh the admin page.

## Validation

108 regression tests passed, including visible editable wording, all three primary tabs, independent confirmation/arrival previews, today/tomorrow countdowns, field-level draft merges, the exact 9–13 → 8–12 → 7–11 sequence on actual scheduled sends, and a queued send crossing Nigeria midnight. Existing consent/STOP, payment verification, deduplication, 24-hour timing, migration and cart/checkout checks remain covered. TypeScript, 88 source safeguards, changed-source ESLint, production build and rendered HTML checks passed.

Browser interaction testing was blocked in this environment. After deployment, check one QA order: edit the daily field, save it, reopen the first confirmation tab, and confirm that the dates and schedule are retained. Previewing or saving must not send an extra message. No live database, GitHub push, Render deployment or customer send was performed during preparation.
