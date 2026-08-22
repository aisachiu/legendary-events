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

Sign-in is **Google, email + password, or SMS OTP** via [Descope](https://app.descope.com) on one form (new users use the same page). Enable **Password**, **OTP (SMS)**, and **Google**. Redirect URLs: `http://localhost:3000/login`, `/account`, and the matching production URLs.

Anyone signed in can create events. Superadmin is still `/admin` (`SUPERADMIN_EMAIL` on first login to that inbox). Phone-only users get a placeholder email until they link a real one on **Account**.

Without Blob env vars, receipts are stored under `uploads-private`.

## GitHub and Vercel

Log in once: `gh auth login` (use `/opt/homebrew/bin/gh` if `gh` is the wrong binary) and, in the browser, [vercel.com](https://vercel.com).

```bash
cd ~/legendary-events
/opt/homebrew/bin/gh repo create legendary-events --public --source=. --remote=origin --push
```

Then in Vercel: **Import** that repo → Storage → **Neon** (`DATABASE_URL` pooled, `DIRECT_URL` direct) → **Blob** → env `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_DESCOPE_PROJECT_ID` → Deploy. Build runs `prisma migrate deploy`. Seed once with `npx prisma db seed` if you want demo users.

Point a Network Solutions domain at Vercel later with a CNAME.

## What is in this version

- Public event list and pages
- Accounts for guests, hosts, and a superadmin desk
- Event create/edit from the host desk
- Free or paid tickets; paid guests **upload a receipt**; hosts **Mark as paid**
- Networking rooms: bios visible to **confirmed** guests only
- Superadmin `/admin` can view and edit all users, events, registrations, and payments
