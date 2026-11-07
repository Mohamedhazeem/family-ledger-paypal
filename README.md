# FamilyLedger 2.0

Consent-first, AI-assisted family-support disbursement platform.
“Make the support plan clear before the money moves.”
Hackathon MVP: USD only, sandbox PayPal, synthetic data.

## What it does

A coordinator creates a disbursement (beneficiary details, full
amount, free-text support intention). AI extracts an editable
allocation plan (never inventing amounts). One invitation link per
disbursement — the beneficiary may **accept**, **suggest changes**,
or **decline to share** a plan (with a voluntary-consent statement
and no payment conditionality). The coordinator compares versions
with a deterministic diff + AI explanation, acknowledges without
writing over the beneficiary's response, and explicitly submits one
full PayPal sandbox payout. Batch and item statuses refresh
separately; duplicates and unknown outcomes are handled safely.
Analytics are aggregate-only; the timeline is append-only.

## Setup

1. Install Node 22 (see `package.json` engines) and PostgreSQL 16.
2. `cp .env.example .env` and fill real values (never commit `.env`).
   Required: `AUTH_SECRET`, `DATABASE_URL`, `APP_ENCRYPTION_KEY`
   (64 hex chars), PayPal sandbox keys + `PAYPAL_ENV=sandbox`, and an
   OpenAI-compatible AI key (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`,
   optional `AI_BASE_URL`). Optional: `AG_STUDIO_LICENSE_KEY`.
3. `npm ci`
4. `npm run db:generate && npm run db:deploy && npm run db:seed`
   (seed is idempotent)
5. `npm run dev` → http://localhost:3000

## Judge / demo credentials

- Email: `alex.morgan@example.com`
- Password: `DemoPass123!` (seeded by `npm run db:seed`; change before any
  non-demo use). Do not commit real credentials.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (pins `NODE_ENV=production`;
  a leaked dev `NODE_ENV` in the shell otherwise breaks prerendering)
- `npm run lint` / `npm run typecheck` / `npm test` — quality and tests
- `npm run e2e` — Playwright flows (against `E2E_BASE_URL` if set)
- `npm run db:seed` / `npm run db:deploy` — seed / migrate

## Operations docs

- [`docs/architecture.md`](docs/architecture.md) — layers and rules
- [`docs/paypal-sandbox.md`](docs/paypal-sandbox.md) — scope grant, OAuth, payout, status, failure guide
- [`docs/deploy-runbook.md`](docs/deploy-runbook.md) — Render deploy, migrations, rollback
- [`docs/verification-log.md`](docs/verification-log.md) — command → outcome per slice
- [`docs/demo-script.md`](docs/demo-script.md) — 3-minute talk track
- [`docs/postman/family-ledger.postman_collection.json`](docs/postman/family-ledger.postman_collection.json)
  + [`family-ledger.postman_environment.json`](docs/postman/family-ledger.postman_environment.json)
  — payout flow, sandbox only

> Regarding APIMatic (spec §15): the PayPal Context Plugin was **not**
> used in this environment; payout request/response shapes were
> verified against the live sandbox API responses and the official
> PayPal Payouts v1 contract instead.

## Environment

See `.env.example` for the full list (spec §24). Secrets live in env only.
