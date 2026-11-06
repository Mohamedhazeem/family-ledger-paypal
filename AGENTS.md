# FamilyLedger 2.0 — AGENTS.md

> Governing manual for AI and human contributors. Spec is sole source of truth: `FamilyLedger_Spec_and_Build_Plan.md`. No requirement, API field, or status may be invented — ambiguous items belong in §16 Open Questions.

## 1. Project snapshot

- Product: FamilyLedger 2.0 — consent-first, AI-assisted family-support disbursement platform.
- Pitch: Make the support plan clear before the money moves.
- Type: Diaspora/employer/charity programmes send one unrestricted PayPal Payouts transfer; allocation categories are a voluntary shared plan, not restrictions on money.
- MVP scope: Next.js full-stack, Postgres/Prisma, Path: coordinator auth, disbursement CRUD, AI plan extraction, beneficiary invitation & portal, deterministic diff + AI explanation, PayPal sandbox Payouts, AG Studio analytics, Playwright tests, Render deploy.
- Out of scope (Part G §21): Live money movement, Indian live Payouts sending, Xoom, C2C remittances, multi-currency/FX, bank/cash-out, escrow/conditional release, recurring payouts, receipt collection/spending surveillance, beneficiary scoring/fraud/eligibility, multi-level approvals, native apps, Redis/queues/microservices, full email/SMS dependency if it delays core flow.
- Target: Hackathon MVP only, USD only, synthetic data, sandbox only. See ADRs in `docs/adr/`.

## 2. Non-negotiable principles (Part A §4, verbatim + code why)

1. The PayPal payout amount is the full disbursement amount. — Never split payout by category.
2. Allocation categories are stored in FamilyLedger, not in a fictitious PayPal `purpose_tag` field. — Model categories locally; PayPal note stays neutral.
3. A category change never triggers another payout. — Plan edits are versioned, payment unchanged.
4. Beneficiary consent to the plan is voluntary and is not a condition for receiving the support payment. — Never gate `paymentStatus` on `planStatus`.
5. The beneficiary can decline to share an allocation plan. — `BENEFICIARY_DECLINED_TO_SHARE` must still allow payout.
6. FamilyLedger does not monitor actual spending and does not verify that money was spent on a category. — No receipts, no surveillance fields.
7. Do not require receipts in the MVP. — Do not add receipt upload/verification flows.
8. AI cannot approve, initiate, cancel or change a payout. — AI is advisory; outputs validated, never mutate payment.
9. A human coordinator explicitly confirms every payment action. — Payout requires separate explicit confirmation.
10. Keep `planStatus` and `paymentStatus` as independent state machines. — Separate enums, separate transitions (ADR-0004).
11. Use synthetic data only in the hackathon demo. — Seed/demo data must be fictional; no real family/money data.
12. Do not claim that the prototype is a live remittance service or production-ready financial product. — Sandbox-only, no live-money claims.

## 3. Architecture overview

- Stack: Next.js App Router + TypeScript (frontend + Route Handlers), Tailwind + shadcn/ui + Lucide, PostgreSQL + Prisma, Zod, Vitest + Playwright, Render. (Parts C §7–§8, ADR-0001, ADR-0002, ADR-0011)
- Rule: Route Handlers are thin — parse/auth/validate (Zod), delegate to `src/services/*`, return typed response. No business rules in handlers.
- Module map:
  - `src/app/(auth)/`, `/dashboard`, `/disbursements`, `/analytics`, `/beneficiary/[token]`, `api/*` — UI + routes
  - `src/components/{dashboard,disbursements,beneficiary,analytics,ui}/`
  - `src/lib/{auth,db,validation,money,security,audit}/`
  - `src/services/{ai,paypal,disbursements,invitations}/` — single-responsibility business logic, testable without Next.js request objects
- Dependency direction: UI → Route Handlers → services/ports → adapters → external. Never the reverse. Services never import adapter SDKs (e.g. PayPal/ OpenAI clients) — only port types. Mappers belong in adapters, not business rules.
- Scalable/efficient: vertical slices, clear seams, no microservices, no premature abstraction beyond defined ports. Smallest change that satisfies spec.

## 4. Ports & Adapters (hexagonal)

| Integration | Port (location) | Adapters | Env selection | Add new adapter |
|---|---|---|---|---|
| AI provider | `src/services/ai/provider.ts` — `AiProvider { parseIntent(), explainDiff(), translate() }` | `OpenAiAdapter`, `MockAiAdapter` | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | Implement port with Zod schemas in `services/ai/schemas.ts`; add adapter file, update factory by env; callers unchanged. |
| PayPal Payouts | `src/services/paypal/client.ts` + `auth.ts` + `payouts.ts` interfaces | `PayPalSandboxAdapter`, `MockPayPalAdapter` | `PAYPAL_ENV`, `PAYPAL_CLIENT_ID/SECRET/WEBHOOK_ID` | Implement port behind `services/paypal/`; register in factory; reuse `PayoutAttempt` idempotency guard. |
| AG Studio analytics | `src/services/analytics/` port `AnalyticsPort` (aggregate-only) | `AgStudioAdapter`, `AgGridFallbackAdapter` | `AG_STUDIO_LICENSE_KEY` | Add adapter exposing same aggregate DTOs; UI unchanged. Fallback = grid only (ADR-0010). |
| Email | `src/services/email/` port `EmailPort` | `NoopEmailAdapter`, `ResendAdapter` (post-MVP) | `EMAIL_PROVIDER` (optional) | Add adapter implementing `send()`, keep invitation links functional without email. |
| Auth | `src/lib/auth/` (`AuthPort`) | `AuthJsCredentials` | `AUTH_SECRET` | New provider implements same session interface; route guards unchanged. |
| DB | `PrismaClient` via `src/lib/db/` (repository ports) | `PrismaPostgres` | `DATABASE_URL` | Swap via Prisma datasource; services use repositories, not raw client in business code. |

- Every adapter: validate external responses with Zod, map to domain DTOs, redact secrets/PII in logs. Business callers depend only on ports (SOLID: single-responsibility services, dependency inversion). See ADR-0016.

## 5. Domain rules (MUST NOT violate)

- Payout = full disbursement, one item, neutral note with `FL-REFERENCE`; categories never fire extra payouts.
- `planStatus` vs `paymentStatus` independent (see §6); acknowledgement is not a release condition.
- AI cannot mutate payment state or determine eligibility; human confirms all payment actions.
- Money: integer minor units; no floating-point arithmetic (see §7).
- No receipts, no spending surveillance, no beneficiary scoring.
- Sandbox-only PayPal; no live-money claims; synthetic data only in demo.

## 6. State machines (Part C §10 — exact enums; change requires ADR update)

- `PlanStatus`: `DRAFT`, `INVITED`, `BENEFICIARY_ACCEPTED`, `REVISION_PROPOSED`, `COORDINATOR_ACKNOWLEDGED`, `BENEFICIARY_DECLINED_TO_SHARE`, `NO_RESPONSE`, `CLOSED`
- `PaymentStatus`: `NOT_SENT`, `READY`, `SUBMITTING`, `STATUS_UNKNOWN`, `PENDING`, `PROCESSING`, `SUCCESS`, `DENIED`, `FAILED`, `UNCLAIMED`, `RETURNED`, `ON_HOLD`, `BLOCKED`, `REFUNDED`, `REVERSED`
- Persist PayPal batch status separately from item `transaction_status`; preserve unknown values, show raw + friendly label. A batch `SUCCESS` ≠ item delivered.

## 7. Money playbook

- Convert once at boundary: `amountText` (decimal string from AI) → integer minor units via decimal-safe library (e.g. `decimal.js`) in `src/lib/money/` — never `Number` math.
- Store `amountMinor` as integer/BigInt; format for display with integer arithmetic.
- Banned: `parseFloat`, `Number(amount)`, `amount * 100`, float sums, float comparisons.
- Safe: `toMinorUnits("500.00") → 50000`; reject &gt;2 decimals, negative/non-decimal.
```ts
// SAFE
const minor = money.toMinorUnits("500.00") // 50000
// UNSAFE (banned): const minor = Math.round(parseFloat("500.00") * 100)
```

## 8. Security & privacy (Part C §13)

- Secrets in env only; PayPal creds/tokens server-side; `.env.example` tracked, never real secrets.
- Encrypt PayPal recipient email AES-256-GCM with `APP_ENCRYPTION_KEY`; never expose to beneficiary portal or register grid.
- Invitation tokens ≥32 bytes random, SHA-256 hash at rest, expiry + revocation, rate-limited public APIs, CSP/SameSite/HttpOnly cookies, CSRF on mutations.
- Zod at every boundary (forms, APIs, AI outputs); coordinator authz on operator APIs; beneficiary APIs expose only shareable data; beneficiary cannot change amount/recipient.
- Redact PII/creds from logs; synthetic names/emails in demo; privacy statement in beneficiary portal.
- See ADRs 0007, 0008, 0015.

## 9. AI rules (Part C §12)

- All AI behind `AiProvider` port; structured JSON + Zod; source `evidenceText` required; never invent amounts or silently fix totals.
- Diff computed deterministically in code; AI only explains that diff; fallback = deterministic template if AI unavailable.
- Translate labels/explanations only; canonical amounts/IDs never translated.
- Treat notes as untrusted data; do not infer sensitive circumstances, dishonesty, or non-compliance; do not claim expenditure verified; do not log sensitive free text/keys.

## 10. PayPal rules (Part C §11)

- Persist unique `sender_batch_id` (+ `sender_item_id`) in `PayoutAttempt` **before** calling PayPal; reuse same ID on 5xx/timeout; never regenerate.
- Single-submission lock via DB transaction/conditional update; stay `SUBMITTING`/`STATUS_UNKNOWN` until real result known; never show Paid on ack alone.
- Batch vs item statuses stored & displayed separately; preserve unknown statuses.
- `MOCK` mode visibly badged `MOCK PAYMENT`; judge demo must use real sandbox call. Follow official PayPal Payouts v1 docs for fields (store dedup within 30 days), do not invent fields. See ADR-0006, ADR-0012.

## 11. Testing (TDD)

- Pyramid: Vitest unit (money, diff, state rules, token/hash, status mapping, duplicate guard) → service integration (OAuth, payout shape, sender-batch-before-call, 5xx handling, AI Zod, authz, append-only events) → Playwright E2E (sign-in → create → AI plan → confirm → beneficiary revision → AI explain → acknowledge → sandbox payout → status → no-duplicate click) → Postman (collection + env template).
- Red → green → refactor: write failing test first, minimal implementation, refactor; keep files ≤300 LOC (§12).
- Assert behavior & invariants, not vanity coverage; every business rule has a test that would fail if violated. See ADR-0014.

## 12. File-size policy + splitting playbook

- Hard limit: **no source file may exceed 300 lines**. CI/pre-commit suggestion:
```bash
# in package.json: "check:file-size": "npx tsx scripts/check-file-size.ts"
# script: walk src/, fail if any file >300 LOC; also lint via eslint-plugin-check-file
```
- Playbook: split services by responsibility (e.g. `paypal/client.ts` → `auth.ts`, `payouts.ts`, `status-mapping.ts`, `errors.ts`); extract hooks from components; move schemas to `schemas.ts`, mappers to `mappers.ts`; split components by `dashboard/disbursements/...` folders; delete dead code, never grow a god-file. If a file must grow, open an ADR exception with rationale. See ADR-0013.

## 13. Commands cheat-sheet (placeholders until stack exists)

```bash
npm install                 # install
npm run dev                 # dev
npm run lint && npm run typecheck   # quality
npm test                    # Vitest
npx playwright test         # E2E
npm run build               # production build
npx prisma migrate dev      # migrate
npm run seed                # seed
# Postman: import collection from docs/postman/ (template provided)
```

## 14. Definition of Done (per-PR, from Part G §22)

- [ ] Meets spec § + maps to ADR(s); state machines untouched or ADR updated
- [ ] Tests written first (red→green), pass locally; lint/typecheck/build green
- [ ] File sizes ≤300 LOC; secrets only in env; logs redacted; money in minor units
- [ ] PayPal: sender-batch persisted before call, single-submission lock, mock badge honored
- [ ] AI: structured output validated, no invented amounts, fallback template exists
- [ ] Docs updated (`verification-log.md`) with command + outcome + limitations

## 15. Third-Party Swap Playbook

1. Add new adapter implementing existing port (`src/services/<name>/`).
2. Add env var selection (e.g. `AI_PROVIDER=new`) + update `.env.example`.
3. Map external response → domain DTO with Zod in adapter; keep business logic untouched.
4. Add adapter contract tests; run full suite; update ADR status if contract changes.

## 16. Open Questions (do not guess — resolve via ADR)

- PayPal Payouts access/scope availability for sandbox business (Day-0 gate, AG Grid sponsor / APIMatic plugin access/licensing).
- AG Studio embedded package + Studio Agent Framework licensing & aggregate view API surface.
- Auth.js vs equivalent session solution final choice; cookie/CSRF specifics.
- AI provider final selection & model; translation provider for en/ta/hi.
- Render health-check + migration runbook specifics; Render Workflows scope (optional).
- Whether `PayPal-Request-Id` is supported for this endpoint; webhook implementation scope (stretch).

## 17. Traceability

| Section | Spec |
|---|---|
| §1–§2, §5, §14 | Part A §4, Part G §21–22 |
| §3–§4, §6 | Part C §7–§10, Part B §6–§10 |
| §7–§10 | Part C §11–§13 |
| §11 | Part E §17 |
| §12–§15 | Engineering policy (ADR-0013) + Part F–G |
| §16, §17 | Spec §26 references |
| All ADRs | Each cites spec Part/§; index in `docs/adr/README.md` |

