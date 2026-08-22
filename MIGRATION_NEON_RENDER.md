# Renova: Neon + Render migration

## 1. Install and configure

```bash
npm install
cp .env.example .env.local
```

Keep `.env.local` private. Fill in the Neon development-branch connection string, Neon Auth URL, cookie secret, and owner emails.

## 2. Create the PostgreSQL tables

```bash
npm run db:migrate:local
```

This applies the SQL in `drizzle-neon/`. It does not use the old `drizzle/` D1 migrations.

## 3. Create the owner account

In Neon, open **Auth → Users → Create user**. Use an email listed in `ADMIN_EMAILS` and create a strong password.

## 4. Run locally

```bash
npm run dev
```

Open `http://localhost:5173/admin/login`, sign in, and then test product and review management.

Image/video uploads require `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. AI image enhancement additionally requires `OPENAI_API_KEY`.

## 5. Verify and push

```bash
npm run build
git add .
git commit -m "Migrate Renova admin to Neon and Render"
git push origin migration/neon-render
```

Do not commit `.env.local` or paste secret keys into GitHub.
