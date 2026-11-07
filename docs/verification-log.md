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
- Slice 3.12: timeline labels are English only (EN/TA/HI dictionaries cover portal chrome; timeline labels are not yet in the dictionaries). Append-only is enforced at the application layer (create-only port + delete/update absent); no DB-level trigger/rule guarding against direct SQL edits.
- Slice 3.8: the shared coordinator PlanItemsEditor's micro-labels (Category/Amount rows, Add/Delete controls) stay in English on the beneficiary suggest form — only portal chrome, consent, and action labels are localized. Static labels only (no AI translation, per NOT).
- Slice 3.7: the detail page is reached by URL for now (no list-screen links yet); PayPal payout itself is a placeholder button (4.x). The page also shows plan version history + PayPal badge status (read-only).
- Slice 3.6: the configured model takes ~60-120s to generate explanations (NIM); unchanged plans return the template instantly (no AI call). Category matching in diffPlans is trimmed + case-insensitive; duplicate category labels pair in order.
- Slice 3.5: double-decline/double-suggest create more versions (no idempotency guard, same as 3.3). Token resolution is duplicated across the four beneficiary use cases — a shared resolver is a follow-up refactor.
- Slice 3.4: PlanVersion.explanation column added (spec §9 says "model at least"); explanation is not yet surfaced in any UI (coordinator compare is 3.7). Double-suggest creates another version (no idempotency guard, same as 3.3).
- Slice 3.3: double-accept mints another version (no idempotency guard yet); accept is allowed from any pre-acceptance state (DRAFT/INVITED/REVISION_PROPOSED treated alike). Suggestion/decline are 3.4/3.5.
- Slice 3.2: no accept/revise actions and no language switcher yet (3.3–3.8). Rate limiting is in-memory (single instance); replace with a shared store if the app scales out. Rate-limited lookups return 404 (indistinguishable from invalid, to avoid enumeration).
- Slice 3.1: invitation revocation/lookup/rate-limiting are 3.2/3.11; the repo port is create-only. An empty follow-up migration followed a first scripted migration that failed validation (missing back-relation) — no history rewritten.
- Build: `npm run build` currently fails prerendering `/_global-error` (`useContext` null) — verified pre-existing: fails identically on committed trees back to `ea2dcc1` (pre-slices) in clean worktrees. Not caused by slices 2.1–2.7. Typecheck/lint/tests pass; production `next start` still serves earlier build output.
- Slice 2.7: Beneficiary + Disbursement + PlanVersion/Items + LedgerEvent are created sequentially (no unit-of-work port, still no transaction). `PlanVersion` immutability is enforced by port design (no update/delete operation exists). Plan `requiresClarification` is persisted false on create (clarification UX lives in 2.6's preview + 3.x revisions).
- Slice 2.6: extracted plan items are session-only (plan persistence is 2.7); save creates Beneficiary + Disbursement only. Beneficiary + Disbursement are created sequentially (no unit-of-work port yet). `playwright.config.ts` now loads `.env` directly instead of importing `src/env` (it crashed without Next's env loading).
- Slice 2.5: no CSRF token on the POST (relies on SameSite cookie, consistent with the existing auth route); no persistence (2.7). Route is coordinator-authenticated (401 without session).
- Slice 2.3: no persistence (2.7). The extraction prompt lives in the adapter; `response_format` is intentionally not set (not all OpenAI-compatible endpoints accept it) — JSON shape is enforced by the Zod schema instead. The adapter strips a single markdown code fence around model output before parsing (observed in the live model).
- Slice 2.2: schema only. No prompt and no model invocation yet (prompt = next slice, invocation = 2.3); `amountText` shape is regex-validated here and converted to minor units in the use case.
- Slice 2.1: port has only the config probe `ping()`; no model call is made yet (model invocation lands in 2.3). No Mock adapter — MSW will stand in for external calls in later-slice tests. `AI_BASE_URL` is an optional env var (defaults to the OpenAI SDK default when unset).
- Slice 1.3: only Organization/User/Beneficiary/Disbursement exist; later-slice models, seed and auth are not yet implemented.
- DATABASE_URL points to localhost; deploy migration to be run against Render Postgres at deploy time via `prisma migrate deploy`.
- TypeScript pinned to 5.9.3 (typescript-eslint incompatibility with TS 7.0).
- Lint warning on eslint-config anonymous default export retained (cosmetic).
