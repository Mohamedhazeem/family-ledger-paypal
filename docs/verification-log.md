# Verification Log

Format: date, command, outcome, known limitation.

- 2026-11-06 npm install — success: 644 packages, 11 moderate audit findings (dependency advisories, no blocking failure). Install-scripts warning for prisma/esbuild noted; `npm audit` is advisory.
- 2026-11-06 tsc --noEmit — exit 0 after fixing `prisma.config.ts` seed key and ReactNode import.
- 2026-11-06 npm run lint — exit 0; 1 warning (eslint-config anonymous default export in eslint.config.mjs). Next peer eslint warning noted; not blocking.
- 2026-11-06 prisma generate (placeholder DATABASE_URL) — success: Generated Prisma Client (v7.10.1) to ./generated/prisma.
- 2026-11-06 next build (DATABASE_URL/Auth secrets placeholder) — success: Next.js 16.4.5 (Turbopack), Compiled successfully, TypeScript finished, 3 static pages (/ /_not-found), no app pages yet per stack-only scope.
- 2026-11-06 Slice 1.3 Schema v1 — `prisma migrate deploy` (migration `20261106193300_init_slice_1_3_schema_v1`) + `prisma generate`: applied 1 migration, DB up to date; `psql \dt` shows Organization, User, Beneficiary, Disbursement (+ `_prisma_migrations` bookkeeping). Integration test inserts+reads back via Prisma client (USD 500 = 50000n BigInt) and cleans up (0 rows left). `tsc --noEmit` 0, `eslint` 0 errors (1 pre-existing warning), `vitest run` 9/9 passed (7 unit + 2 integration).

- 2026-11-07 Slice 2.1 AI port + adapter — `npx vitest run src/infrastructure/ai/provider.test.ts`: 4/4 passed (builds from env, AI_BASE_URL change flips adapter baseURL, unknown provider throws, ping returns provider+model). `npx tsc --noEmit` 0, `npm run lint` 0 errors, `npm test` 8 files/33 tests passed, `npm run build` success (route `/api/ai/ping`). M check: `npm run start -p 3177`, `curl http://localhost:3177/api/ai/ping` → HTTP 200 `{"provider":"openai","model":"google/gemma-4-31b-it"}`.

Known limitations:
- Slice 2.5: no CSRF token on the POST (relies on SameSite cookie, consistent with the existing auth route); no persistence (2.7). Route is coordinator-authenticated (401 without session).
- Slice 2.3: no persistence (2.7). The extraction prompt lives in the adapter; `response_format` is intentionally not set (not all OpenAI-compatible endpoints accept it) — JSON shape is enforced by the Zod schema instead. The adapter strips a single markdown code fence around model output before parsing (observed in the live model).
- Slice 2.2: schema only. No prompt and no model invocation yet (prompt = next slice, invocation = 2.3); `amountText` shape is regex-validated here and converted to minor units in the use case.
- Slice 2.1: port has only the config probe `ping()`; no model call is made yet (model invocation lands in 2.3). No Mock adapter — MSW will stand in for external calls in later-slice tests. `AI_BASE_URL` is an optional env var (defaults to the OpenAI SDK default when unset).
- Slice 1.3: only Organization/User/Beneficiary/Disbursement exist; later-slice models, seed and auth are not yet implemented.
- DATABASE_URL points to localhost; deploy migration to be run against Render Postgres at deploy time via `prisma migrate deploy`.
- TypeScript pinned to 5.9.3 (typescript-eslint incompatibility with TS 7.0).
- Lint warning on eslint-config anonymous default export retained (cosmetic).
