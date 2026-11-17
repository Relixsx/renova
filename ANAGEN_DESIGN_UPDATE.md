# Renova — Gold and Electric Lime Anagen pages

17 November 2026

This combined update serves the approved Radiant Gold design at `https://shoprenova.com.ng/anagen` and the approved Electric Lime design at `https://shoprenova.com.ng/anagen2`. Both are normal pages within the existing Renova website. They share one landing-page component, the same Anagen product, inventory, prices, order form and order endpoint. The product wordmark, canonical URL, social-sharing URL and product offer URL stay on the page the customer opened. Existing product and offer links continue to use `/anagen`.

The white comparison frames, black Before/After lettering, unchanged picture files, swipe gallery, higher product display, shimmer and gold glow are retained. The ten generated comparisons remain clearly labeled as illustrations, not customer photographs or evidence of results. Reduced-motion preferences retain a static glow. The product image is eager-loaded from the same optimized local WebP.

## More visible 24-hour delivery

Both pages now have a charcoal delivery banner. The main **24-HOUR DELIVERY** headline uses much larger, heavier gold or electric-lime lettering; the state-capital and dispatch qualification stays readable directly underneath. This is static HTML and CSS, with no added animation, images, JavaScript or dependencies. The approved button shimmer and the rest of both designs are retained.

## Apply this combined package

1. Download and extract `renova-anagen-dual-pages-20261117.zip` into Downloads. Use this combined package for both pages.
2. Run in Terminal:

```bash
bash "$HOME/Downloads/renova-anagen-dual-pages/apply-renova-anagen-dual-pages.sh"
```

The default project is `$HOME/Documents/Renova_Store`. Pass a different full repository path as the first argument if required. The installer expects branch `migration/neon-render` and the completed Aiven/owner-email code at `b26e2f0`. It recognizes the earlier approved design updates, including the saved Gold and Electric Lime versions, whether committed or still uncommitted. It checks all payloads before writing, backs up source files and refuses unrelated owner changes. It preserves existing credentials and environment settings. No product setup, stock reset or database migration is needed.

## Check the installed code

```bash
cd "$HOME/Documents/Renova_Store" &&
npx tsc --noEmit --incremental false &&
npm test &&
git diff --check
```

If dependencies are missing, first run `npm ci --include=dev --legacy-peer-deps`. The tests use isolated local database fixtures and mocked notifications. They do not place customer orders or send customer messages.

The native production checks request both landing pages, confirm their own canonical/offer URLs and intended theme classes, check the form, current prices, local product image and all ten illustration pairs, and exercise the existing product redirects and maintenance behavior. The shared order endpoint remains `/api/anagen/order` for both pages.

## Push and deploy

After the checks pass, run:

```bash
cd "$HOME/Documents/Renova_Store" &&
git add -- app/anagen/page.tsx app/anagen/anagen.module.css app/components/anagen-order-form.tsx app/lib/anagen-order.ts tests/anagen.test.mjs tests/anagen-rendered.test.mjs app/components/anagen-illustration-gallery.tsx ANAGEN_DESIGN_UPDATE.md public/anagen/product-studio.webp public/anagen/illustrations/hair-01.webp public/anagen/illustrations/hair-02.webp public/anagen/illustrations/hair-03.webp public/anagen/illustrations/hair-04.webp public/anagen/illustrations/hair-05.webp public/anagen/illustrations/hair-06.webp public/anagen/illustrations/hair-07.webp public/anagen/illustrations/hair-08.webp public/anagen/illustrations/hair-09.webp public/anagen/illustrations/hair-10.webp app/components/anagen-landing-page.tsx app/anagen2/page.tsx app/sitemap.ts &&
git commit -m "Add Gold and Electric Lime Anagen landing pages" &&
git push origin migration/neon-render
```

In Render, open the existing `renova` service and choose **Manual Deploy → Deploy latest commit**. Keep the existing `npm run start` command and current Aiven, email and WhatsApp configuration. Then open both URLs on your phone:

- Gold: `https://shoprenova.com.ng/anagen`
- Electric Lime: `https://shoprenova.com.ng/anagen2`

The production forms use the current Renova order system. The included `anagen-design-comparison.html` is a separate offline visual comparison with ordering disabled; it is not the file to upload as the production site.

## Validation completed

The underlying dual-page package was prepared from all 362 files of the current GitHub deployment branch at `b26e2f0afb7bf4834c19cbb1d5e0100b09d74288`, verified against the repository's blob hashes. The delivery-banner revision passes the native Next.js production build, its TypeScript check and both native production page/maintenance tests. The unchanged checkout, WhatsApp and owner-email code previously passed 148 tests; Aiven/owner authentication passed 18 tests; the two native production page/maintenance tests passed. The preceding cumulative, AI listing and admin verification passed 88 safeguards. Those unchanged backend checks are not repeated for this banner-only revision. Dependencies and the lockfile are unchanged.

Installer checks cover baseline, previous dual-page and prior design application, repeat runs, backups, preservation of ignored generated state, owner changes, conflicting new route files, wrong branches, changed prerequisites, corrupt downloads and rollback. The installer changes local project files; Git push and Render deployment are the separate steps above.

## Backups

The installer prints its backup path under the repository's Git data. It saves every replaced file there before writing. If a write fails, files already changed are restored, including removal of newly created payload files. After committing, a normal Git revert can restore the previous revision.
