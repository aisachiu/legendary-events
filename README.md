# Legendary Events

Host public events, take signups, collect payment **receipts**, and open attendee bios only after someone is confirmed.

## Local

Postgres is required (SQLite is gone). With Docker:

```bash
docker compose up -d
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo accounts (password `legendary` — **change these in production**):

- Host: `host@legendary.events`
- Guest: `guest@legendary.events`
- Superadmin: `admin@legendary.events` → `/admin`

Without a `BLOB_READ_WRITE_TOKEN`, receipts are stored under `public/uploads`.

## Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add a **Neon** Postgres database. Set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct).
3. Add a **Vercel Blob** store (`BLOB_READ_WRITE_TOKEN` is injected).
4. Set `AUTH_SECRET` (long random string) and `NEXT_PUBLIC_APP_URL` to `https://your-app.vercel.app`.
5. Deploy. The `vercel-build` script runs `prisma migrate deploy`.
6. Seed once against Neon if you want demo users: `npx prisma db seed` with production `DATABASE_URL` / `DIRECT_URL`.

Point a Network Solutions domain at Vercel later with a CNAME; not required for the first `*.vercel.app` URL.

## What is in this version

- Public event list and pages
- Accounts for guests, hosts, and a superadmin desk
- Event create/edit from the host desk
- Free or paid tickets; paid guests **upload a receipt**; hosts **Mark as paid**
- Networking rooms: bios visible to **confirmed** guests only
- Superadmin `/admin` can view and edit all users, events, registrations, and payments
