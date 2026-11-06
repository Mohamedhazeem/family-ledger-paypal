# FamilyLedger 2.0

Consent-first, AI-assisted family-support disbursement platform.
Hackathon MVP: USD only, sandbox PayPal, synthetic data.

## Setup

1. Install Node 22 (see `.nvmrc`) and PostgreSQL 16.
2. `cp .env.example .env.local` and fill real values (never commit `.env.local`).
   Required: `AUTH_SECRET`, `DATABASE_URL`, `APP_ENCRYPTION_KEY`.
   PayPal sandbox + NVIDIA NIM keys for the live demo.
3. `npm ci`
4. `npm run db:generate && npm run db:migrate && npm run db:seed`
5. `npm run dev` → http://localhost:3000

## Judge / demo credentials

- Email: `alex.morgan@example.com`
- Password: `DemoPass123!` (seeded by `npm run db:seed`; change before any
  non-demo use). Do not commit real credentials.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` / `npm run typecheck` — quality
- `npm test` — Vitest
- `npm run e2e` — Playwright
- `npm run db:seed` — seed §16 scenario
- `npm run db:reset` — reset DB (dev only)
- `npm run format` — Prettier

## Tests

`npm test` (unit + integration) and `npm run e2e` (browser flow).

## Environment

See `.env.example` for the full list (spec §24). Secrets live in env only.
