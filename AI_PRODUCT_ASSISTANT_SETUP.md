# Renova AI Product Assistant

The assistant is an owner-only shortcut into the existing Add Product form. It
does not replace manual product creation and does not publish automatically.

It now has its own focused route at `/admin/ai-listing`. It accepts one to
three product images. Payment method and promotion are explicit owner controls:
select Pay before delivery or Payment on delivery, then decide whether the
product should show Renova's existing recurring promo. AI does not choose or
overwrite those commercial settings.

## Environment

If `OPENAI_API_KEY` is already configured for Ask Renova or AI Product Studio,
no additional API key is required.

Required server variable:

```text
OPENAI_API_KEY=your_existing_secret_key
```

Optional model override:

```text
OPENAI_PRODUCT_MODEL=gpt-5.4-mini
```

Keep these values in `.env.local` for local development and in Render's
Environment settings for production. Never prefix either value with
`NEXT_PUBLIC_` and never commit the actual secrets.

No new package dependency or database migration is required.

## Use

1. Sign in at `/admin`.
2. Open **AI listing**, which routes to `/admin/ai-listing`.
3. Choose one to three product images.
4. Enter a rough product name and any optional known details.
5. Choose **Pay before delivery** or **Payment on delivery**.
6. Choose whether the product should carry a promo and, when enabled, enter
   the promo wording and optional compare-at price.
7. Select **Generate listing**.
8. Review the proposed category, title, duplicate warning, research references
   and all uncertainty flags.
9. Select **Review in product form**.
10. Verify every field in the normal Renova Add Product form.
11. Leave **Publish immediately** off to save a draft, or turn it on only after
   the listing is confirmed.

The selected originals are retained for the existing catalogue image pipeline.
Smaller analysis copies are sent through the authenticated Renova backend for
AI processing.

## Pre-deployment checks

```bash
npm install
npm run verify:ai-listing
npm run build
npm run dev
```

Open `/admin/ai-listing` and test both paths:

- Create one unpublished product through AI Product Assistant.
- Open **New product** and confirm the original manual form still works.

Do not run a database migration for this feature.

## Error recovery

- Inputs and images stay in the assistant after an AI error.
- **Generate listing** becomes **Regenerate listing** after a result.
- A missing API key produces a server configuration message.
- A rate-limit message means the OpenAI project needs available usage or a
  short retry delay.
- Unsupported or oversized analysis images are rejected before generation.
