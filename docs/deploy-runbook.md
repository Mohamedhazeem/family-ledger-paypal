# Deploy runbook (Slice 5.2)

How to deploy FamilyLedger 2.0 to Render. Sandbox-only; no
live-money deployment in the MVP (spec Part G §21).

## 1. Environment (single source of truth: `.env.example`)

Render service env vars (dashboard or `render.yaml`): `NODE_ENV`,
`APP_URL`, `AUTH_SECRET`, `DATABASE_URL`, `APP_ENCRYPTION_KEY`,
`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `PAYPAL_ENV`,
`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `DEMO_MODE`, `PORT`
(provided by Render at runtime).

## 2. Deploy (web service + managed PostgreSQL)

1. Create the blueprint from `render.yaml` (or create a Web Service
   + PostgreSQL manually with the same values).
2. First deploy: Render builds (`npm install && npm run build`) and
   starts (`npm run db:deploy && npm run start`). The health check
   polls `GET /api/health` → `{"status":"ok"}`. (Free tier has no
   `preDeployCommand`, so migrations run in `startCommand`.)
3. If auto-deploy is on, every push to `main` redeploys.
   Seeding is automatic: `startCommand` runs `npm run db:deploy && npm run db:seed`,
   and the seed is idempotent (upserts), so repeated starts are safe. No shell
   access needed (works on the free tier).

## 3. Migrations

Migrations run BEFORE the app starts accepting traffic:

```bash
# Inside a Render shell for the family-ledger service (or locally
# against the managed DATABASE_URL):
npx prisma migrate deploy
npx prisma generate
npm run db:seed   # idempotent; seeds the judge/demo coordinator
```

> The seed is idempotent — run it once for a fresh database.
> The dashboard register + manual invite flow need no other data.

## 4. Post-deploy verification

```bash
curl "$APP_URL/api/health"          # {"status":"ok"}
# Then in a browser (clean session):
#   sign in as the seeded coordinator (README credentials),
#   create a disbursement, extract, invite, accept, pay (sandbox).
```

## 5. Rollback

Render keeps the previous deploy; roll back from the dashboard
(deploys list). Database migrations are additive — rolling back
code does not require rolling back the schema unless a migration
is reverted manually (avoid; prefer forward fixes).
