# Automatic delivery messages, with a simpler screen

27 October 2026. This is a follow-up to the installed Jumia countdown and message-editor update. It uses the existing database migration 0007. There is no new migration, dependency, API key, Meta template change or Worker change.

## Install

Download `renova-simple-reminders-20261027.zip` and unzip it in Downloads. It extracts a **renova-simple-reminders** folder.

```bash
bash "$HOME/Downloads/renova-simple-reminders/apply-renova-simple-reminders.sh" &&
cd "$HOME/Documents/Renova_Store" &&
npm run test:whatsapp &&
npx tsc --noEmit --incremental false &&
npm run verify:cumulative &&
git diff --check
```

The installer expects the installed 26 October countdown source on `migration/neon-render`. It verifies affected files, requires a clean repository, backs up replacements inside Git metadata, and rolls back an application failure. If only the generated `tsconfig.tsbuildinfo` is modified, restore that cache using `git restore -- tsconfig.tsbuildinfo`; preserve any other edits.

## The normal workflow

1. Open **Admin → Orders** or **Admin → Reminders**, find the order and open **Delivery dates & automatic messages**.
2. Enter Jumia's **Expected from** and **Expected to** dates. A single expected date only needs the first field.
3. Read the complete WhatsApp message that appears automatically, then select **Save changes**.

That is all. There are no customer-name, status or countdown buttons to insert. Renova prepares the complete message using the actual customer name, website order number, ordered items, payment amount and dates. The preview updates as you change the dates. The next scheduled message calculates the days remaining again using Nigeria time.

For example, a window of **6–9 November 2026** says **10–13 days** on 27 October, then **9–12 days** on 28 October. In the delivery window, it says delivery is expected today or within the remaining days. After the window, it explains that the estimate has passed and arrival is not confirmed. It never claims arrival based only on a date.

Saving and previewing do not send an extra message or change the 24-hour schedule. Existing active orders continue on their schedule. Stopped orders stay stopped, and older orders still require the customer's agreement before messaging is started.

## Wording changes are optional

**Optional: customise the wording** holds the daily/arrival message edits, extra verified courier information, delivery/collection line and optional email fields. Leave it closed to use the ready-made messages. The default message box is blank with a ready-made-message hint; it does not require any template variables. Existing genuine custom wording stays in place. Save changes after any optional edits.

Store defaults are under **Admin → Reminders → Optional: change the store's message wording**. Orders with custom wording retain it. Untouched defaults from the previous editor adopt the simpler automatic body without rewriting database records.

The preview comes from the same formatter used for sending, including WhatsApp's length limit. Email and SMS use the same selected reminder wording through their existing layouts. No OpenAI integration is needed.

## Confirmation and arrival

The first order confirmation remains automatic, separate and uses the website's regional estimate. Jumia dates entered later do not change it.

The arrival message is also prepared automatically. In **3. Arrival and collection reminder**, enter the verified collection location/details, confirm that the parcel has arrived, then use **Confirm arrival and start arrival reminders**. Arrival reminders use their own wording, continue every 24 hours while enabled, and stop on collection, completion, customer STOP or owner stop. An estimated date never activates arrival messages.

## Commit and deploy

After the local checks pass, review `git diff`, then:

```bash
cd "$HOME/Documents/Renova_Store" &&
git diff --check &&
git add -- app tests SIMPLE_DELIVERY_REMINDERS.md JUMIA_DELIVERY_COUNTDOWN.md REMINDER_MESSAGE_EDITOR.md WHATSAPP_SETUP.md WHATSAPP_ORDER_CONTROLS.md REMINDER_BOT_SETUP.md &&
git commit -m "Simplify automatic delivery reminder messages" &&
git push origin migration/neon-render
```

Wait for the new commit to show **Live** on Render. Existing Jumia dates and settings are retained; simply open an order to see the new preview. No Neon or Render configuration step is required for this follow-up.

## Validation

101 regression tests passed, including actual order details in a preview without saved message fields, untouched legacy defaults, custom wording preservation, daily date changes, paid/COD wording, consent/STOP, concurrent sends, arrival verification, migration rollback and the existing cart/checkout protections. TypeScript, 88 source safeguards, changed-source ESLint, the production build and rendered HTML check also passed.

Preparation did not connect to the live database, deploy the store or send customer messages. After Render is Live, check a QA order with a recipient you control. Opening the preview and saving dates should send nothing immediately. The next scheduled message should show that sending day's countdown.
