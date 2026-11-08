# FamilyLedger 2.0

> **Make the support plan clear before the money moves.**

A consent-first, AI-assisted family-support disbursement platform.
Hackathon MVP (PayPal AI Hackathon 2026): **USD only · PayPal Payouts
sandbox · synthetic data only**. This is a prototype for evaluation — not
a live remittance service and not a production-ready financial product.

---

## What this project is about

FamilyLedger is a tool for **diaspora associations, employers, charities
and community-support programmes** that send household support payments.

A programme coordinator usually has an intended use for the money — rent,
school fees, medicine — but says it informally ("$300 for rent, $150 for
school, $50 for food" in a chat message). The recipient may have
different or changing priorities, and language barriers turn good
intentions into misunderstandings **before the money moves**.

FamilyLedger lets the coordinator draft the intended plan in natural
language, AI turns it into a structured, editable allocation plan, and the
beneficiary receives a secure link to **accept, suggest changes, or
decline to share** any plan. AI explains any differences in neutral
language. The coordinator then sends **one full, unrestricted PayPal
payout** — the payment is never split, restricted, or conditioned on the
plan. FamilyLedger records the plan and the payment as two separate
things, with an append-only history.

## The problem it solves

| Today | With FamilyLedger |
|---|---|
| Intent lives in informal chat messages; misinterpretation surfaces only after money arrives | The plan is explicit, structured and mutually understood **before** disbursement |
| Purpose tags or restricted funds make the payer's wish a condition, and the recipient loses autonomy | The plan is a **voluntary shared understanding**; the payout is always the full amount |
| Recipients are surveilled for compliance (receipts, proof of spending) | No receipts, no spending monitoring — consent and dignity stay intact |
| Cross-language support breaks down | AI translates labels and explanations; **amounts and IDs are never translated** |
| Payment and agreement history are tangled | `planStatus` and `paymentStatus` are **independent state machines**; every transition is an append-only event |

## How it works (end-to-end)

1. **Coordinator creates a disbursement** — beneficiary, full amount (USD), and a free-text support intention.
2. **AI extracts a proposed plan** — categories + amounts with `evidenceText` per line; AI never invents an amount, and a sum over the total is rejected deterministically.
3. **Coordinator confirms the draft** — fully editable, deterministic total validation.
4. **Beneficiary invitation** — one secure, expiring, revocable link per disbursement (copyable; no email dependency).
5. **Beneficiary reviews** in a preferred language (en / ta / hi) — accepts, suggests changes, or declines to share. A voluntary-consent statement is shown; **responding is never a condition of payment**.
6. **AI explains the revision** — neutral language over a **deterministic diff** (diff is computed in code, never by AI).
7. **Coordinator acknowledges** — without overwriting the beneficiary's response.
8. **One full PayPal sandbox payout** — explicit human confirmation, single item, neutral note with only the `FL-` reference.
9. **Live status** — batch status and item status are stored and shown **separately**; unknown statuses are preserved verbatim.
10. **Shared timeline** — append-only audit events both parties can see.

### Seeded demo scenario (synthetic)

Organisation *Community Family Support Programme* → coordinator **Alex
Morgan** → beneficiary **Maria Santos** → **USD 500.00**.
Note: *"Please allocate $300 for rent, $150 for school fees and $50 for
food."* Beneficiary moves the last $50 from *Food* to *Medicine*; AI
explanation: *"The beneficiary proposed changing the final $50 allocation
from food to medicine. The total support amount remains $500. The PayPal
payment amount is unchanged."*

## The PayPal + AI solution (the hackathon core)

Two integrations carry the product. Both sit behind application-layer ports
(`src/application/ports/ai.ts`, `src/application/ports/paypal.ts`), so business
logic depends on interfaces — never on vendor SDKs. Swapping a provider means
adding one adapter file; no use case, state machine, or screen changes.

### PayPal Payouts — one real sandbox payment, sent safely

**Flow:** coordinator clicks *Send full payment* → a `PayoutAttempt` row is
persisted **before** any external call, carrying a unique `sender_batch_id` and
`sender_item_id` → the adapter exchanges client credentials for a cached OAuth
token (auto-refreshed, and retried once on 401) after verifying the
`https://uri.paypal.com/payments/payouts` scope → it POSTs
`/v1/payments/payouts` with **exactly one item for the full amount** and a
neutral note containing only the `FL-` reference → the returned batch id and
status are stored verbatim → *Refresh status* GETs the batch, and the batch
status and the item `transaction_status` are mapped to our `PaymentStatus`
and stored **separately**.

**Rules honoured end to end:**

- One item, the full disbursement amount — the payout is never split by allocation category, and a plan edit never triggers a second payout.
- `sender_batch_id` persisted before the call and **reused on retry**; PayPal dedupes within 30 days, so an uncertain retry cannot double-pay. A single-submission lock keeps the row in `SUBMITTING`/`STATUS_UNKNOWN` until a real result is known.
- HTTP failure < 500 is definitive (`FAILED`/`DENIED`); 5xx or timeout is **unknown** — the app says so instead of showing a fake paid state.
- Batch `SUCCESS` never implies item delivery: a `SUCCESS` batch can still hold an `UNCLAIMED` item. Unknown statuses (e.g. the seeded `FOO` row) are preserved verbatim next to a friendly label.
- No invented fields: request/response shapes follow the official Payouts v1 contract, verified against live sandbox responses — a real sandbox batch was created and polled during the build (see `docs/verification-log.md`).
- `PAYPAL_ENV=live` throws: this MVP is sandbox-only, and no claim of live-money sending is made anywhere.
- `MOCK` mode (`PAYPAL_ENV=mock`) selects the offline MockPayPalAdapter for tests/dev; rows created through it are visibly badged `MOCK PAYMENT`; the judge demo uses a real sandbox call. Unknown statuses (e.g. the seeded `FOO` row) are preserved verbatim next to a friendly label.

Credential setup, OAuth curl, and the failure guide: [`docs/paypal-sandbox.md`](docs/paypal-sandbox.md).

### AI — advisory only, every output validated

Three jobs, all behind `AiProvider` (OpenAI-compatible adapter, selectable via
`AI_PROVIDER` / `AI_BASE_URL`, e.g. a local or third-party endpoint; offline
MockAiAdapter via `AI_PROVIDER=mock`):

1. **Parse support intent** — an informal note becomes a structured plan: summary, items with `category`, `amountText` (or `null`), `evidenceText` per line, `confidence`, and a `requiresClarification` flag. Output is validated by a **strict Zod schema** (unknown keys rejected, evidence required). Deterministic rules then police the result: the total may not exceed the disbursement, no amounts are inferred, and each amount is converted once into integer minor units with decimal-safe math — never floats.
2. **Explain the revision** — the version-to-version diff (e.g. `~ Rent: $300.00 → $250.00 (−$50.00)`, `+ Added Medicine`) is computed in **deterministic code**. AI receives only that diff and writes one short neutral sentence; the prompt forbids computing or inventing amounts and forbids judgment language ("misused", "suspicious"). If the model is unavailable, a deterministic fallback explanation is built from the same diff.
3. **Translate labels/explanations** — `POST /api/ai/translate` translates display text into en/ta/hi behind the same `translate()` port method (schema-validated; the prompt forbids changing amounts or IDs). The beneficiary portal itself uses static en/ta/hi label dictionaries so amounts and identifiers stay canonical; **canonical amounts and identifiers are never translated**. The model is never in the payment path.

**Hard limits:** AI cannot approve, initiate, cancel, or change a payout, cannot decide
eligibility, and cannot infer sensitive circumstances. Untrusted note text is treated
as data, never as instructions — and sensitive free text is never logged.

### Why the two belong together

AI resolves intent **before** disbursement; PayPal moves the full amount
**after**. Neither depends on the other: AI never touches payment state, and the
payout never depends on plan status — the beneficiary may decline to share a
plan and still receive the complete payment. That separation is the product.

## What makes it different

Judged on features, not vendor names:

- **Payment and intent are separated by design.** Exactly one PayPal payout for the full disbursement amount. Allocation categories live in FamilyLedger — not in any payment rail field — so a plan edit can never trigger, split, or block a payment.
- **Consent-first, payment-unconditional.** The beneficiary can accept, revise, or **decline to share** a plan and still receive the full payment. Consent is requested; eligibility is never gated on it.
- **AI is advisory-only.** It cannot approve, initiate, cancel, or change a payout. Structured output is Zod-validated, every amount carries `evidenceText`, and nothing is silently invented.
- **Deterministic core, AI on top.** Diffs, totals, state transitions and status mapping are computed in plain code; AI only explains and translates. If AI is unavailable, deterministic templates carry the same flows.
- **Honest payment engineering.** `sender_batch_id` is persisted *before* the PayPal call and reused on retries (PayPal dedupes for 30 days); a single-submission lock and `SUBMITTING`/`STATUS_UNKNOWN` states mean an uncertain timeout is never shown as paid. A batch `SUCCESS` can still contain an `UNCLAIMED` item — both are stored and displayed separately.
- **Privacy by construction.** PayPal recipient emails are AES-256-GCM encrypted at rest and never exposed to the beneficiary portal. No receipts, no spending verification, no beneficiary scoring — deliberately out of scope.
- **Two independent state machines.** `PlanStatus` (DRAFT → INVITED → ACCEPTED / REVISION_PROPOSED / DECLINED_TO_SHARE / NO_RESPONSE → CLOSED) and `PaymentStatus` (NOT_SENT → SUBMITTING → PENDING/SUCCESS/UNCLAIMED/…) never mutate each other.
- **Multilingual without corruption.** Labels and explanations localise (en/ta/hi); canonical amounts and references never change mid-translation.
- **Aggregate-only programme analytics** (AG Studio, with a labelled AG Grid fallback) plus copyable links and a Postman collection for sandbox verification.

## Non-negotiable product principles

1. The PayPal payout amount is the full disbursement amount — never split by category.
2. Allocation categories are stored in FamilyLedger, not in a payment field.
3. A category change never triggers another payout.
4. Beneficiary consent is voluntary and never a condition of receiving the payment.
5. The beneficiary can decline to share an allocation plan — and still be paid.
6. FamilyLedger does not monitor actual spending or verify category use.
7. No receipts are required anywhere in the MVP.
8. AI cannot approve, initiate, cancel or change a payout.
9. A human coordinator explicitly confirms every payment action.
10. `planStatus` and `paymentStatus` stay independent state machines.
11. Synthetic data only in the demo — no real families, no real money.
12. No claims of a live remittance service or production-ready finance product.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind + shadcn-style components ·
PostgreSQL 16 + Prisma 7 · Zod · Better Auth · OpenAI-compatible AI
adapter · PayPal Payouts REST v1 (sandbox) · AG Grid / AG Studio ·
Vitest + Playwright · Render. Clean Architecture: domain entities →
use cases → port adapters → thin route handlers (see `docs/architecture.md`).

---

## Quick start for judges

### Prerequisites

- Node 22 (`package.json` engines) and PostgreSQL 16 running locally
- A terminal and ~10 minutes

### Steps

```bash
1. cp .env.example .env        # then fill in values (see Environment variables below)
2. npm ci
3. npm run db:generate && npm run db:deploy && npm run db:seed   # seed is idempotent, synthetic
4. npm run dev                 # → http://localhost:3000
```

Sign in at `/login` with the seeded coordinator:

- Email `alex.morgan@example.com` · Password `DemoPass123!`
  (created by `npm run db:seed`; synthetic — change before any non-demo use)

### 3-minute walkthrough

1. **Dashboard** → open the seeded disbursement `FL-SEED-001` (Maria Santos, USD 500.00, DRAFT).
2. **Extract plan** with AI → three editable categories; edit an amount past the total to see the deterministic over-total block.
3. **Create invitation** → copy the link, open it (mobile viewport shows the beneficiary portal): consent statement, language switcher (en/ta/hi), **Accept / Suggest changes / Decline to share**.
4. **Suggest a change** → back on the coordinator side, compare v1 vs v2: deterministic diff plus the neutral AI explanation — the payment amount is still USD 500.00.
5. **Acknowledge**, then **Send full payment** → a real PayPal sandbox batch; refresh to read batch and item status separately. A second click cannot duplicate it.
6. **Analytics** → aggregate-only workspace. `FL-SEED-002` is a seeded `MOCK`-mode row that demonstrates the `MOCK PAYMENT` badge and an unknown status (`FOO`) surfaced verbatim.

Full talk track: [`docs/demo-script.md`](docs/demo-script.md).

### Without PayPal sandbox credentials

Everything except the live payout call runs with placeholder PayPal values —
the app fails fast with an actionable error on the send step rather than
faking success, and the seeded `MOCK` row still demonstrates status
handling. Never stage a fake success: sandbox or mock, always labelled.

---

## Setup prompt for an AI coding agent

If a judge or reviewer wants an AI agent to set the project up for them,
paste the block below into any coding agent (Claude Code, Zed, Cursor…)
from the repository root. It is self-contained and only asks for secrets
that a human must supply.

```text
You are setting up the FamilyLedger 2.0 repository (Next.js 16 + Prisma 7 +
PostgreSQL) so a judge can run and evaluate it locally. Work through the
steps in order; stop and ask the human only for values you cannot generate.

1. Verify prerequisites: Node 22+ and a reachable PostgreSQL 16 instance.
   Report versions before continuing.
2. Copy .env.example to .env. Never commit .env; never write real secrets
   into any tracked file.
3. Generate the two secrets yourself:
   - AUTH_SECRET: 32+ random characters.
   - APP_ENCRYPTION_KEY: exactly 64 hex characters (32 bytes), used for
     AES-256-GCM encryption of the PayPal recipient email.
4. Ask the human (by variable name, never as pasted-in source edits) for:
   - DATABASE_URL (PostgreSQL connection string)
   - AI_PROVIDER, AI_API_KEY, AI_MODEL (an OpenAI-compatible endpoint;
     AI_BASE_URL only if the endpoint is not OpenAI)
   - PAYPAL_ENV=sandbox, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
     (PayPal sandbox app with the payouts scope granted — see
     docs/paypal-sandbox.md §1)
   - Optional: AG_STUDIO_LICENSE_KEY (without it the analytics screen runs
     a labelled AG Grid fallback)
   If PayPal sandbox credentials are unavailable, use placeholder values and
   state clearly that the live payout step cannot run; do not simulate a
   PayPal success.
5. Run, in order: npm ci → npm run db:generate → npm run db:deploy →
   npm run db:seed. Fix only setup-level failures (missing env vars, database
   not reachable); do not change application logic without asking.
6. Start the app with npm run dev and verify http://localhost:3000 returns
   HTTP 200 and the login page renders.
7. Smoke test: sign in as alex.morgan@example.com / DemoPass123! and confirm
   the dashboard and the disbursement register render.
8. Run quality gates: npm run lint, npm run typecheck, npm test. Report any
   failures verbatim.
9. Report back with: exact commands run, outcomes, app URL, seeded login,
   and any remaining blockers. Do not commit anything unless explicitly
   asked. Keep all data synthetic; this prototype is sandbox-only and must
   never be described as moving real money.
```

---

## Environment variables

Full list lives in `.env.example` (template — never commit real values).
`src/env.ts` validates these at boot with Zod; a missing value fails fast.

| Variable | Required | What it is |
|---|---|---|
| `NODE_ENV` | yes | `development` / `test` / `production` |
| `APP_URL` | yes | Base URL of the app, e.g. `http://localhost:3000` |
| `AUTH_SECRET` | yes | Better Auth session secret, ≥16 chars |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_ENCRYPTION_KEY` | yes | Exactly 64 hex chars (32 bytes); AES-256-GCM key for the encrypted PayPal recipient email |
| `AI_PROVIDER` | yes | AI provider id, e.g. `openai` (OpenAI-compatible) |
| `AI_API_KEY` | yes | AI provider API key |
| `AI_MODEL` | yes | Model id used for extraction / explanation / translation |
| `AI_BASE_URL` | optional | Base URL for non-OpenAI OpenAI-compatible endpoints |
| `PAYPAL_ENV` | yes | `sandbox` for the judge demo; `mock` selects the offline adapter for tests/dev (`live` is out of scope and throws) |
| `PAYPAL_CLIENT_ID` | yes | PayPal sandbox app client id |
| `PAYPAL_CLIENT_SECRET` | yes | PayPal sandbox app secret |
| `PAYPAL_WEBHOOK_ID` | optional | Webhook verification id (stretch feature) |
| `AG_STUDIO_LICENSE_KEY` | optional | Enables AG Studio analytics; otherwise a labelled AG Grid fallback renders |
| `DEMO_MODE` | yes | Demo-labelling flag (e.g. `true`) |
| `PORT` | optional | Injected by Render; not needed locally |

Where the PayPal values come from: PayPal Developer Dashboard → sandbox
app → client id/secret, with the `https://uri.paypal.com/payments/payouts`
scope granted — step-by-step in [`docs/paypal-sandbox.md`](docs/paypal-sandbox.md).

## Commands

- `npm run dev` — dev server
- `npm run build` / `npm run start` — production build + serve
- `npm run lint` · `npm run typecheck` · `npm test` — quality gates
- `npm run e2e` — Playwright end-to-end flows (honours `E2E_BASE_URL` if set)
- `npm run db:generate` · `db:deploy` · `db:seed` · `db:reset` — database

## Scope boundaries (read before demoing)

- **Sandbox only.** No live money, no live-country sending claims. PayPal classifies India as receive/withdraw, so live Payouts from an Indian sender is explicitly out of scope.
- **Synthetic data only** in seed and demo.
- **No receipts, no spending surveillance, no beneficiary scoring.**
- **AI never touches payment state** and a human confirms every payout.
- `MOCK` payment rows are visibly badged `MOCK PAYMENT`; the judge demo
  uses a real sandbox call.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — layers, dependency rules
- [`docs/paypal-sandbox.md`](docs/paypal-sandbox.md) — scope grant, OAuth, payout/status flow, failure guide
- [`docs/deploy-runbook.md`](docs/deploy-runbook.md) — Render deploy, migrations, rollback
- [`docs/verification-log.md`](docs/verification-log.md) — command → outcome per slice
- [`docs/demo-script.md`](docs/demo-script.md) — 3-minute talk track
- [`docs/repo-page.md`](docs/repo-page.md) — GitHub About description, topics, apply/verify runbook
- [`docs/implementation-plan.md`](docs/implementation-plan.md) — build checklist
- [`docs/postman/family-ledger.postman_collection.json`](docs/postman/family-ledger.postman_collection.json) + environment template — API-verifiable payout flow (sandbox)
- [`AGENTS.md`](AGENTS.md) — contributor rules; [`FamilyLedger_Spec_and_Build_Plan.md`](FamilyLedger_Spec_and_Build_Plan.md) — full spec (single source of truth)

> Note: the APIMatic PayPal Context Plugin was not used in this environment;
> payout request/response shapes were verified against live sandbox API
> responses and the official PayPal Payouts v1 contract.

## License

MIT — see [`LICENSE`](LICENSE).
