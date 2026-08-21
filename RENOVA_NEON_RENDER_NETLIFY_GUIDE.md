# Renova: VS Code, GitHub, Neon, Render and Netlify Guide

## Read this first

The current Renova source is a full-stack Vinext application built for a Cloudflare Worker runtime. It currently uses:

- Cloudflare D1 through `drizzle-orm/d1` for products, reviews and orders.
- Cloudflare R2 for product images and videos.
- Server routes inside `app/api` for Paystack, tracking, media, email and the AI assistant.
- Sites owner authentication for the private admin page.

Neon is PostgreSQL, not D1. Render is a Node server, not a Cloudflare Worker. Netlify cannot safely host only the current frontend because checkout, Paystack verification, tracking, admin uploads and the AI assistant all depend on server routes.

Therefore, do not connect this unchanged source to Neon and expect it to work. Use one of the two paths below.

## Path A: fastest safe launch

Keep the current full-stack deployment while completing the business configuration. It already runs the storefront, database and uploads together.

Before making it public, configure:

1. `PAYSTACK_SECRET_KEY`
2. `FORMSPREE_ENDPOINT`
3. `RESEND_API_KEY`
4. `ORDER_FROM_EMAIL`
5. Either `OPENAI_API_KEY` or `GEMINI_API_KEY`
6. A tested Paystack webhook
7. A real order, email and tracking test

This is the only realistic same-day route without rewriting the storage and server layers.

## Path B: Neon + Render + Netlify

Use this when you want an independently hosted architecture. Treat it as a migration project.

### Target architecture

```text
Customer browser
   |
   +-- Netlify: storefront frontend
   |
   +-- Render: secure API and admin backend
            |
            +-- Neon PostgreSQL: products, orders, reviews, tracking
            +-- Cloudflare R2 or Cloudinary: product media
            +-- Paystack: payments and webhooks
            +-- Resend: customer email
            +-- Formspree: owner order notification
            +-- OpenAI or Gemini: product assistant
```

Do not place Paystack, Resend, OpenAI or Gemini secret keys in Netlify frontend variables that are exposed to browser code. Secrets belong only on Render.

## Part 1: open the source in VS Code

1. Extract `Renova_Store_Complete_Source_Code.zip`.
2. Move the resulting folder to `Documents`.
3. Open VS Code.
4. Select **File > Open Folder** and choose the Renova folder.
5. Open **Terminal > New Terminal**.
6. Check Node.js:

```bash
node --version
npm --version
```

Use Node.js 22.13 or newer.

7. Install packages:

```bash
npm ci
```

8. Create the local environment file:

```bash
cp .env.example .env.local
```

9. Start locally:

```bash
npm run dev
```

Open the address printed in the terminal.

## Part 2: create and push the GitHub repository

1. Create a new private GitHub repository named `renova-store`.
2. Do not initialise it with another README or `.gitignore`.
3. In VS Code Terminal run:

```bash
git init
git add .
git status
git commit -m "Initial Renova store"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/renova-store.git
git push -u origin main
```

Confirm that `.env.local` is not shown in `git status` and never commit it.

## Part 3: create Neon PostgreSQL

1. Create a Neon account and new project.
2. Choose a region close to your expected customers and Render service.
3. Copy the pooled PostgreSQL connection string.
4. Save it privately as `DATABASE_URL`.
5. Enable SSL in the connection string.

The code must then be migrated from SQLite/D1 syntax to PostgreSQL:

1. Replace `drizzle-orm/d1` in `db/index.ts` with the Neon serverless PostgreSQL driver.
2. Replace `sqliteTable` and SQLite column definitions in `db/schema.ts` with `pgTable` and PostgreSQL definitions.
3. Change `drizzle.config.ts` from `dialect: "sqlite"` to `dialect: "postgresql"`.
4. Generate a new PostgreSQL migration. Do not run the existing SQLite migration against Neon.
5. Run the new migration against a development Neon branch first.
6. Test product creation, checkout, Paystack verification, order tracking and reviews.

Recommended packages for that migration:

```bash
npm install @neondatabase/serverless
```

Do not delete the current D1 implementation until the Neon version passes all tests.

## Part 4: replace media storage

The current upload routes use the `BUCKET` R2 binding. Choose one option:

### Option 1: Cloudflare R2

Keep R2, create independent S3-compatible credentials and update the media routes to use the R2 S3 API from Render.

Render variables will include:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_BASE_URL
```

### Option 2: Cloudinary

Use Cloudinary for simpler image and video transformations. Keep uploads signed by the Render backend so browser users never receive the API secret.

## Part 5: create the Render backend

The current application is not yet separated into frontend and backend. For the Render architecture, move all server responsibilities into a dedicated API service.

The Render backend must own:

- Admin authentication and authorisation
- Products and categories
- Product uploads
- Reviews
- Checkout initialisation
- Paystack verification and webhook
- Orders and tracking
- Customer email
- Formspree owner notification
- OpenAI or Gemini requests

Create a Render Web Service connected to the private GitHub repository. Use Node.js 22.

Add private Render variables:

```text
NODE_ENV=production
DATABASE_URL=your_neon_pooled_connection
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_WEBHOOK_SECRET=if_used_by_your_implementation
FORMSPREE_ENDPOINT=https://formspree.io/f/...
RESEND_API_KEY=re_...
ORDER_FROM_EMAIL=Renova <orders@yourdomain.com>
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-nano
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
FRONTEND_URL=https://your-netlify-domain.netlify.app
ADMIN_EMAIL=relixsx@gmail.com
SESSION_SECRET=a-long-random-secret
```

Never put supplier costs, Paystack secrets or AI keys in responses sent to the frontend.

Render health checks should use a simple endpoint such as `/api/health` that returns HTTP 200 without querying external services.

## Part 6: create the Netlify frontend

After the API is separated:

1. Import the GitHub repository into Netlify.
2. Set the frontend base directory if it is moved into a separate folder.
3. Set the production frontend API variable:

```text
NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...
```

Only variables beginning with `NEXT_PUBLIC_` may be read by browser code, and none of them may contain secrets.

4. Configure Render CORS to allow only the real Netlify domain and final custom domain.
5. Update Paystack callback and webhook URLs after the final domains exist.

## Part 7: domain setup

You can use `relixsxstore.xyz` or buy a new brand domain.

Recommended structure:

```text
www.yourdomain.com      Netlify storefront
api.yourdomain.com      Render backend
```

Configure DNS using the exact values provided by Netlify and Render. Enable HTTPS on both before live payment testing.

Then set:

```text
FRONTEND_URL=https://www.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

## Part 8: Paystack launch checklist

1. Start with Paystack test keys.
2. Place a test order.
3. Confirm the amount is calculated on the backend from database prices.
4. Confirm Paystack verification marks the order paid.
5. Confirm refreshing the success page does not duplicate payment processing.
6. Set the webhook URL:

```text
https://api.yourdomain.com/api/paystack/webhook
```

7. Verify the Paystack signature on every webhook.
8. Confirm the customer email and owner notification.
9. Confirm order tracking requires both order number and matching email.
10. Only then replace test keys with live keys in Render.

## Part 9: chatbot checklist

1. The assistant must accept general questions on every page.
2. On product pages, it receives only approved public product facts and FAQs.
3. It must never receive supplier cost, supplier URL or internal notes.
4. Add the chosen provider key only to Render.
5. Set request limits and message-length limits.
6. Keep the grounded local fallback active when the AI provider fails.
7. Test delivery, price, stock, warranty, returns and unknown questions.

## Part 10: final launch test

Test on desktop and a real mobile phone:

1. Homepage and animated banners
2. Search, spelling tolerance and filters
3. Every category
4. Product galleries and video
5. Product variants
6. Cart quantities and totals
7. All Nigerian states and matching LGAs
8. Delivery options
9. Paystack test payment
10. Confirmation email
11. Owner notification
12. Tracking with correct and incorrect email
13. Ask Renova on the homepage and a product page
14. Admin product creation with five images
15. Return policy, privacy and terms
16. Mobile performance

## What “ready to launch today” means

The current hosted architecture can be launched today after keys and payment tests are complete. The Neon, Render and Netlify architecture requires the database, media, authentication and API migration described above. It is not a safe same-day environment-variable change.
