# Tech Stack Contract — FamilyLedger 2.0

> Single source of truth for pinned versions. Resolved from npm 2026-11-06. Every later task must obey this file. Contradictions with AGENTS.md/ADRs are resolved in favour of ADRs.

## Stack table

| Area | Choice | Pinned version | Why | Spec ref |
|---|---|---|---|---|
| Full-stack | Next.js App Router + TypeScript, single deployable | 16.4.5 | One build/ship path, Runtime fits Render Web Service | Part C §7 (ADR-0001, ADR-0011) |
| UI runtime | React + React DOM | 19.3.1 / 19.3.1 | Next 16 peer | Part C §7 |
| Language | TypeScript | 5.9.3 | Next/eslint compatible; TS 7.0 breaks typescript-eslint (see gotchas); stable 5.9.3 keeps lint green | Part C §7 |
| DB | PostgreSQL + Prisma ORM | prisma 7.10.1, @prisma/client 7.10.1, @prisma/adapter-pg 7.10.1 | Single source of truth, transactional idempotency, aggregate analytics | Part C §7, §9 (ADR-0002) |
| Money | decimal.js, integer minor units in DB (BigInt) | 10.6.0 | Exact arithmetic; BigInt avoids Int overflow on programme aggregates | Part C §7, §9, ADR-0003 |
| Auth | Better Auth (email/password, Prisma adapter) | 1.7.18 | Prisma-native, stable, HttpOnly SameSite cookies; Auth.js v5 fallback if role/session gaps | Part C §7, §13 (ADR-0008) |
| Validation | Zod | 4.6.7 | All trust boundaries; safeParse + Zod 4 error API | Part C §13 (ADR-0015) |
| Env boot | @t3-oss/env-nextjs | 0.13.11 | Fail-fast readable error; no ad-hoc process.env in services | Part C §13, §24 |
| Logging | pino (redaction) | 10.4.0 | Redact authorization, cookie, paypal*secret*, *_token, receiver, free-text notes | Part C §13 |
| Forms | react-hook-form + @hookform/resolvers + sonner | 7.91.0 / 7.0.3 / 2.0.8 | No hand-rolled state; toasts for feedback | Part C §7 |
| UI styling | Tailwind CSS v4 + shadcn/ui + Lucide | 4.3.4 / 1.70.0 | CSS-first, no tailwind.config.* | Part C §7 |
| Analytics | AG Studio 3 (default harness + server-side LLM proxy) + AG Grid React fallback | ag-grid-react 36.3.0 | Sponsor primary; aggregate-only views | Part D §14G, ADR-0010 |
| PayPal | PayPal Payouts REST API v1, sandbox only, via thin server-only adapter | api sandbox | Full payout must be real; persist sender_batch_id before call; SDK types never leak past adapter | Part C §11, ADR-0006, ADR-0012 |
| APIMatic | PayPal Context Plugin before adapter | npx context-plugins install paypal | Request fields from live contract, not memory | Part D §15 |
| Unit tests | Vitest + @testing-library/react + jsdom + vite-tsconfig-paths | 5.1.0 / 16.3.3 / 31.0.0 / 6.1.1 | TDD; logic in src/services (Server Components not Vitest-testable) | Part E §17, ADR-0014 |
| Network mocks | MSW | 3.0.4 | Mock AI + PayPal in unit/integration tests | Part E §17 |
| E2E | Playwright | 1.65.0 | Full 11-step demo flow | Part E §17–§18 |
| File-size | ESLint max-lines 300 + lint-staged + husky | lint-staged 17.6.0, husky 9.1.7 | Makes ADR-0013 real; pre-commit gate | ADR-0013 |
| Hosting | Render Web Service + Render Postgres | render.yaml | 0.0.0.0:$PORT (10000), DATABASE_URL from DB, prisma migrate deploy pre-deploy | Part D §15, Part F Day 5 |
| Seed | prisma/seed.ts via tsx, idempotent upserts | tsx 4.23.15 | Exact spec scenario; explicit not automatic | Part E §16 |

All versions exact in package.json (no ^/~) + package-lock.json committed.

## Runtime & toolchain

- Node 26.12.0 pinned via `.nvmrc` (26) and `engines.node: 26`.
- npm 11.20.0.
- Lockfile: `package-lock.json` committed; CI uses `npm ci`.

## Directory conventions

```
src/
  app/                 # Route Handlers thin, pages; proxy.ts for middleware
  components/          # UI components, shadcn ui/
  lib/                 # auth, db, validation, money, security, audit (no SDK imports)
  services/
    ai/                # AiProvider port (provider.ts), adapters, schemas.ts
    paypal/            # PayPal port + Sandbox/Mock adapters — only file importing PayPal SDK
    analytics/         # AnalyticsPort (aggregate-only) + AG Studio adapter
    disbursements/ invitations/ # business rules
  env.ts               # @t3-oss/env-nextjs schema, imported by instrumentation.ts
prisma/
  schema.prisma        # generated client -> ../generated/prisma (committed output path)
  migrations/          # tracked; prisma migrate deploy at deploy time
  seed.ts              # explicit `npm run db:seed`
tests/e2e/             # Playwright
generated/             # Prisma client output (not committed; path is committed)
```

Dependency direction: UI → Route Handlers → services/ports → adapters → external. Business rules never import vendor SDKs.

## Dependency policy

- Allowed: pinned stack above + libraries serving an approved stack row.
- Requires ADR: any new third-party integration, any change to a port, any non-goal addition (Redis, BullMQ, queues, microservices, tRPC, GraphQL, monorepo, Docker Compose, Python service… see AGENTS.md §17).
- One library per concern; no overlapping dependencies.

## Local dev commands and CI

Local:
```
npm ci
cp .env.example .env.local  # fill real values, never commit
npm run dev                 # next dev (or turbo)
npm test                    # vitest run
npx playwright test         # e2e
npm run db:generate && npm run db:migrate && npm run db:seed
```
CI sequence:
```
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
```
Hooks: `npx husky init` + lint-staged runs ESLint + Prettier check on staged *.ts/tsx.

## Gap-fill notes (one sentence each)

1. Version pinning — Exact versions, no ^/~, lockfile committed, recorded here with date 2026-11-06.
2. Next.js 16 — Async params/searchParams/cookies()/headers(), proxy.ts not middleware.ts, Turbopack default, Server Actions public POST with validate+authorise, `import 'server-only'` in server-only modules.
3. Prisma 7 — `prisma.config.ts` holds datasource+migrations; seed explicit via `prisma db seed` (via `npm run db:seed` → `tsx prisma/seed.ts`); generated client output `../generated/prisma` (committed path); `prisma migrate deploy` for deploy.
4. Money — DB `BigInt` (not Int) to safely hold programme-scale aggregates; conversion via decimal.js; `number` arithmetic banned via ESLint `no-restricted-syntax` for parseFloat + review; format via integer arithmetic.
5. Auth — Better Auth primary (Prisma adapter, email/password) with HttpOnly SameSite cookies, server-side session checks on every operator route, seeded judge account; Auth.js v5 fallback only if Better Auth cannot meet session/role requirements.
6. Zod 4 — `safeParse` everywhere, `z.record` with explicit key type, unified error API (`z.treeifyError`); schemas for requests, AI output, PayPal responses, env vars.
7. Env boot — @t3-oss/env-nextjs in `src/env.ts`, imported by `instrumentation.ts`, fails fast with readable error; services never read `process.env` directly.
8. Logging — pino with redact list: authorization, cookie, paypal*secret*, *_token, receiver, free-text notes; `no-console` rule enforced in `src/services/**`.
9. Forms — react-hook-form + @hookform/resolvers/zod + sonner toasts; no hand-rolled form state.
10. UI — Tailwind v4 CSS-first (`@import "tailwindcss"`, no tailwind.config.*), shadcn/ui, Lucide; shadcn CLI compatibility with Next 16.4.5 to be verified before generating components.
11. Testing — Vitest 5 + RTL + jsdom + vite-tsconfig-paths; Playwright for E2E; MSW for AI/PayPal mocking; async Server Components not unit-tested with Vitest — push logic into `src/services/**`, cover rendered flow with Playwright.
12. File-size — ESLint `max-lines: 300` (skip blank lines and comments) in `eslint.config.mjs`, plus husky + lint-staged pre-commit gate; ADR-0013 enforced in CI.
13. PayPal adapter — Thin server-only module wrapping `POST /v1/payments/payouts` + `GET /v1/payments/payouts/{id}`; persist `sender_batch_id` BEFORE call, reuse on 5xx/timeout, never regenerate on uncertainty; SDK types never leak; confirm sandbox Payouts capability enabled before Day 1 ends.
14. APIMatic first — Run `npx context-plugins install paypal` BEFORE writing PayPal adapter; use generated context for request fields; record actual usage in README.
15. AG Studio 3 — Default harness + server-side LLM proxy (API key never to client); agents/tools query aggregate-only views; no emails/tokens/notes; fallback to AG Grid React recorded honestly if sponsor access unavailable.
16. Render — `render.yaml` web service + Postgres; 0.0.0.0:$PORT (default 10000); DATABASE_URL sync:false from DB; `prisma migrate deploy` as pre-deploy command; no DB access at build time.
17. Seed — `prisma/seed.ts` run via `tsx` (`npm run db:seed`), idempotent upserts, exact spec scenario (org, coordinator, beneficiary, USD 500, three-line note); explicit, not automatic.
18. Postman — Collection + env template for create disbursement, parse-intent, invitation accept/revision/decline, create payout, get payout status; no secrets committed.

## Known version-specific gotchas

- Next.js 16: `params`/`searchParams`/`cookies()`/`headers()` are async; `proxy.ts` replaces `middleware.ts`; Turbopack default; Server Actions are public POST endpoints — validate + authorise internally; use `import 'server-only'` in server-only modules.
- Prisma 7: `datasource.url` removed from schema — URLs live in `prisma.config.ts` `datasource.url`; PrismaClient needs adapter (here `@prisma/adapter-pg`) passed to constructor; generator output must be explicit (`../generated/prisma`); `migrate deploy` at deploy.
- TypeScript 7.0: `typescript-eslint` does not support TS 7 — pinned to 5.9.3 for lint compatibility (not 7.0.2). When TS ≥7.1 ships, re-evaluate.
- Zod 4: `z.record` requires explicit key type; error API is unified (`z.treeifyError`); `safeParse` preferred.
- Tailwind v4: CSS-first config (`@import "tailwindcss"`), no `tailwind.config.*`; shadcn CLI must be verified with Next 16.4.5.
- Vitest 5: async Server Components cannot be unit-tested — logic in `src/services/**`, flows via Playwright.

## Swap matrix

| To replace | Change file | Env var |
|---|---|---|
| AI provider | `src/services/ai/provider.ts` + new `src/services/ai/<adapter>.ts` | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` |
| PayPal sandbox→live/other | `src/services/paypal/client.ts` (only SDK-importing file) + factory | `PAYPAL_ENV`, `PAYPAL_CLIENT_ID/SECRET/WEBHOOK_ID` |
| AG Studio → AG Grid fallback | `src/services/analytics/` adapter (aggregate DTOs unchanged) | `AG_STUDIO_LICENSE_KEY` |
| Better Auth → Auth.js v5 | `src/lib/auth/` (`AuthPort`) | `AUTH_SECRET` (+ new provider vars) |
| Postgres host | `prisma.config.ts` `datasource.url` + Prisma adapter | `DATABASE_URL` |
| Email (post-MVP) | `src/services/email/` (NoopEmailAdapter → ResendAdapter) | `EMAIL_PROVIDER` (optional) |

