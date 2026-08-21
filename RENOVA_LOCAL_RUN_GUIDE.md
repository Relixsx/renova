# Renova Store: Complete Step-by-Step Run Guide

This guide explains how to download, open, configure, run, test, and build the Renova Store source code on a Mac using VS Code. It also explains which functions work locally and which functions require the hosted Sites environment.

## 1. What you need

Install these applications before starting:

1. **Visual Studio Code**: <https://code.visualstudio.com/>
2. **Node.js 22**: Renova requires Node.js `22.13.0` or newer.
3. **Git**: macOS normally installs it when you install the Command Line Tools.
4. A web browser such as Chrome.

You do not need to install a separate database application for an ordinary storefront preview.

## 2. Install Node.js 22 on macOS

The easiest method is the official Node.js installer:

1. Go to <https://nodejs.org/en/download>.
2. Download the macOS installer for Node.js 22 LTS.
3. Complete the installation.
4. Open Terminal and check the installation:

```bash
node --version
npm --version
```

The Node.js result must be `v22.13.0` or higher. If an older version appears, update Node.js before continuing.

## 3. Download and extract Renova

1. Download `Renova_Store_Complete_Source_Code.zip`.
2. Open your Mac's **Downloads** folder.
3. Double-click the ZIP file.
4. A folder named `renova-store` will appear.
5. Move that folder to a convenient location, for example your Documents folder.

The resulting path may look like:

```text
/Users/yourname/Documents/renova-store
```

## 4. Open the project in VS Code

You may use either method.

### Method A: Open it from VS Code

1. Start Visual Studio Code.
2. Select **File → Open Folder**.
3. Select the extracted `renova-store` folder.
4. Click **Open**.
5. If VS Code asks whether you trust the folder, select **Yes, I trust the authors**.

### Method B: Open it from Terminal

```bash
cd ~/Documents/renova-store
code .
```

If the `code` command is unavailable, open VS Code, press `Command + Shift + P`, search for **Shell Command: Install 'code' command in PATH**, and run it once.

## 5. Open the VS Code terminal

Inside VS Code:

1. Select **Terminal → New Terminal**.
2. Confirm that the terminal is inside the Renova folder:

```bash
pwd
```

The output should end with `/renova-store`.

You can also confirm that the correct files are present:

```bash
ls
```

You should see files and folders such as `app`, `db`, `public`, `package.json`, `package-lock.json`, and `RENOVA_SETUP.md`.

## 6. Install the project packages

Run:

```bash
npm ci
```

Wait until installation finishes. This creates the local `node_modules` folder. It can take several minutes on the first run.

Use `npm ci`, not `npm run install:ci`, on a normal Mac. The `install:ci` helper was designed for the Linux hosting build environment.

If installation succeeds, npm returns to the normal terminal prompt without a fatal error.

## 7. Create your private environment file

The source includes `.env.example`. Copy it to `.env.local`:

```bash
cp .env.example .env.local
```

Open `.env.local` in VS Code. For an initial design preview, use:

```text
PAYSTACK_SECRET_KEY=
FORMSPREE_ENDPOINT=
```

The store will open and browsing/cart features will work, but payment will remain unavailable until a Paystack key is added.

### Safe Paystack testing

Use a **Paystack test secret key** first:

```text
PAYSTACK_SECRET_KEY=sk_test_your_actual_test_secret_key
```

Do not start local development with your live key. Switch to `sk_live_...` only in the protected environment settings of the final production host.

### Formspree testing

After creating a Formspree form, add its endpoint:

```text
FORMSPREE_ENDPOINT=https://formspree.io/f/your_form_id
```

Configure that form to send notifications to `airebirth5@gmail.com`.

Important security rules:

- Never paste a secret key into a source-code file.
- Never upload `.env.local` to GitHub.
- Never send your Paystack secret key in a screenshot or public message.
- The included `.gitignore` already prevents `.env` files from being committed.

## 8. Start Renova locally

Run:

```bash
npm run dev
```

Wait until the terminal displays the local address. It will normally be similar to:

```text
http://localhost:5173
```

Open that exact address in Chrome. Do not close the terminal while using the local site.

If port 5173 is already occupied, Vite may choose another port such as 5174. Always use the address printed in your terminal.

## 9. Test the storefront

Check the following pages and actions:

1. Open the homepage.
2. Scroll through all product categories.
3. Open a category.
4. Open an individual product.
5. Select a variation where available.
6. Add the product to the cart.
7. Change the quantity in the cart.
8. Continue to checkout.
9. Select a Nigerian state.
10. Confirm that the LGA list changes for that state.
11. Enter the city/town, street address, and optional delivery instructions.
12. Select a courier and confirm the price:
    - Jumia Delivery: free
    - GIG Logistics: ₦7,000
    - Sendbox: ₦6,000
    - Fez Delivery: ₦5,500
    - Kwik: ₦4,500
13. Confirm that the order total changes correctly.
14. Test search from the navigation bar.
15. Resize the browser window to confirm the mobile layout.

## 10. Understand the local-preview limitations

Renova was built for the Sites hosting environment. That environment provides three services that are not ordinary files inside the ZIP:

1. **Protected ChatGPT sign-in** for `/admin`
2. **D1 database storage** for products, reviews, and orders
3. **R2 object storage** for uploaded product images and videos

Therefore, the local run is primarily for viewing and editing the storefront. The built-in catalogue can still appear because Renova has a safe seed-catalogue fallback.

The complete admin workflow is available on the hosted Renova site:

```text
https://renova-store.relixsx.chatgpt.site/admin
```

Sign in with an authorised owner account:

- `relixsx@gmail.com`
- `airebirth5@gmail.com`

Do not remove the owner check or add an insecure local admin bypass. If Renova is later moved to an independent host, replace the Sites sign-in with a proper authentication provider and connect compatible database/object storage services.

## 11. Test Paystack correctly

Use Paystack's test mode before using real money.

1. Log in to Paystack.
2. Turn on **Test Mode**.
3. Open **Settings → API Keys & Webhooks**.
4. Copy the test secret key beginning with `sk_test_`.
5. Put it in `.env.local`.
6. Stop the running server with `Control + C`.
7. Restart it:

```bash
npm run dev
```

8. Add a product to the cart and complete checkout.
9. Use a Paystack test payment method from Paystack's official test documentation.
10. Confirm that Paystack redirects to Renova's payment-verification route.

Renova does not mark an order as paid merely because the customer clicks the payment button. The server verifies the transaction with Paystack first.

### Local webhook limitation

Paystack cannot normally send a webhook to `localhost` because it is not a public internet address. The browser callback can still return to your local site and perform verification. Configure the webhook only after you have a public HTTPS domain.

Production webhook format:

```text
https://YOUR_DOMAIN/api/paystack/webhook
```

## 12. Test Formspree notifications

1. Create a Formspree form.
2. Verify the receiving email address.
3. Copy the endpoint into `.env.local`.
4. Restart the development server.
5. Complete a Paystack test payment.
6. Check the receiving inbox and spam folder.

The notification is sent only after payment has been verified. It includes the order number, amount, customer information, products, address, and courier.

## 13. Stop and restart the site

To stop it, click inside the terminal and press:

```text
Control + C
```

To run it again later:

```bash
cd ~/Documents/renova-store
npm run dev
```

You only need to run `npm ci` again when dependencies change, `node_modules` is deleted, or you download a fresh copy.

## 14. Build the project

The normal project build command is:

```bash
npm run build
```

The included verified build wrapper expects the GNU `timeout` command used by the Linux host. On macOS, install GNU core utilities first:

```bash
brew install coreutils
```

If Homebrew is not installed, install it from <https://brew.sh/> and then run the command above.

After installation, GNU timeout is normally available as `gtimeout`, while the project wrapper expects `timeout`. The most reliable production build is performed by the Sites hosting checkpoint. For ordinary Mac development, `npm run dev` is sufficient. Do not edit the verified build script merely to force a deployment.

If you specifically need to run the verified build on your Mac, temporarily add Homebrew's GNU command directory to that one command:

```bash
PATH="$(brew --prefix coreutils)/libexec/gnubin:$PATH" npm run build
```

## 15. Main folders you will edit

```text
app/                         Pages, components, checkout, admin and APIs
app/components/              Storefront, cart and admin interface components
app/lib/                     Catalogue, delivery and payment logic
app/api/                     Product, media, review, checkout and Paystack routes
db/                          D1 database schema and connection
drizzle/                     Database migration files
public/                      Logos, category images and product images
.env.example                 Environment-variable template
RENOVA_SETUP.md              Short production configuration guide
```

Useful page files include:

```text
app/page.tsx                         Homepage
app/shop/page.tsx                    Shop page
app/products/[slug]/page.tsx         Product-detail page
app/cart/page.tsx                    Cart
app/checkout/page.tsx                Checkout
app/admin/page.tsx                   Owner dashboard
app/globals.css                      Site-wide design and responsive styles
```

## 16. Save your work with Git

After making and testing changes:

```bash
git status
git add .
git commit -m "Update Renova store"
```

Before committing, run:

```bash
git status
```

Confirm that `.env.local` is not listed. Never use `git add -f .env.local`.

## 17. Push the project to GitHub

### Create an empty repository

1. Sign in to GitHub.
2. Click **New repository**.
3. Name it `renova-store`.
4. Choose **Private** while payment and business configuration are unfinished.
5. Do not add another README, `.gitignore`, or licence during repository creation.
6. Create the repository.

### Connect and push

GitHub will show your repository URL. In the VS Code terminal, run:

```bash
git init
git add .
git commit -m "Initial Renova store source"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/renova-store.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

If `git remote add origin` says that `origin` already exists, check it:

```bash
git remote -v
```

Change it only if it is incorrect:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/renova-store.git
```

## 18. Production launch checklist

Do not accept real customer payments until all items below are complete:

- Replace Paystack's test key with the live secret in protected host settings.
- Never place the live key in GitHub.
- Add the final HTTPS Paystack webhook URL.
- Configure and verify the Formspree recipient.
- Confirm the final domain.
- Make a complete test order.
- Verify the exact paid amount against the order total.
- Confirm that the success page appears only after verified payment.
- Confirm that the email notification contains the complete order.
- Confirm that the order appears in the owner dashboard.
- Replace presentation-only catalogue/review content before representing it as real customer activity.
- Confirm stock, current price, previous price, variants, delivery fee, return policy, and delivery timeframe for every advertised product.
- Test the final site on an Android phone, iPhone, desktop Chrome, and a slow mobile connection.

## 19. Common problems

### `zsh: command not found: npm`

Node.js is not installed correctly. Install Node.js 22 and restart Terminal and VS Code.

### `Unsupported engine` or wrong Node version

Check:

```bash
node --version
```

Upgrade to Node.js `22.13.0` or newer.

### `npm ci` fails

Make sure you are inside the folder containing `package-lock.json`. Then retry on a stable internet connection:

```bash
rm -rf node_modules
npm ci
```

Deleting `node_modules` is safe because it contains downloaded dependencies, not your source code.

### The browser says the page cannot be reached

Make sure `npm run dev` is still running and use the exact local address printed in the terminal.

### Checkout says Paystack is waiting for the secret key

Add a valid test secret to `.env.local` and restart the development server.

### `/admin` redirects or does not recognise the owner locally

This is expected outside the Sites authentication environment. Use the protected hosted `/admin` page for the complete owner workflow.

### Product upload fails locally

The uploaded media requires the configured R2 storage binding. Use the hosted owner dashboard, or configure equivalent Cloudflare D1/R2 infrastructure when migrating to an independent deployment.

### A database write fails locally

The hosted app uses its injected D1 database. The source fallback can display the catalogue locally, but permanent product, review, and order writes require the D1 binding and migration.

## 20. Recommended first session

For your first attempt, follow only this sequence:

```bash
cd ~/Documents/renova-store
npm ci
cp .env.example .env.local
npm run dev
```

Then open the local URL, test the homepage, search, one product page, cart, address fields, and delivery fees. Use the already-hosted `/admin` page when you want to test product creation and media uploads.
