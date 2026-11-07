# FamilyLedger 2.0 — Implementation plan

Derived from `FamilyLedger_Spec_and_Build_Plan.md` (§25 deliverables)
and the slice cards used in this repository.

## Stack

Next.js 16.4.5 (App Router, Turbopack) + React **19.3.1** (pinned —
the Next-bundled React must match; a leaked `NODE_ENV` into build
workers breaks static prerendering, so the build script pins
`NODE_ENV=production`) · TypeScript 5.9.3 · PostgreSQL 16 + Prisma
7.10.1 · Tailwind 4 + shadcn/ui + lucide-react · Vitest + Playwright ·
Render deploy with `render.yaml` + `/api/health`.

## Slice map (all landed, in commit order)

| Slice | What it delivered |
|---|---|
| 1.3 | Schema (Organization/User/Beneficiary/Disbursement) + seed |
| 1.4–1.5 | Coordinator auth (Better Auth) + proxy guards |
| 2.1–2.5 | AI port + OpenAI-compatible adapter (NVIDIA NIM in dev) → extraction schema → `ParseSupportIntent` → `POST /api/ai/parse-intent`; verified live against the sandbox model |
| 2.4 | Money value object (BigInt minor units) |
| 2.6–2.7 | New-disbursement form (extract → edit → save) + immutable PlanVersion v1, PlanItems, LedgerEvent, over/under-total validation |
| 3.1–3.12 | 32-byte invitation tokens + SHA-256 storage; beneficiary portal (EN/TA/HI, rate-limited); accept / suggest / decline actions; deterministic diff + AI explanation fallback; coordinator compare screen; revoke; shared timeline with role visibility; append-only ledger |
| 4.1–4.8 | PayPal sandbox OAuth (cache, scope check) → attempt-commit-first → real payouts (one item, full amount) → single-submission lock → unknown-outcome retry with the same batch id → status polling with separate batch/item states → dual badges + MOCK badge → sandbox guide + Postman collection |
| 5.0 | Hardening: per-IP rate limits (10/min), security headers, pino redaction, origin check, LICENSE + architecture doc |
| 5.1 | Analytics port over aggregate DTOs; AG Studio embed (needs a licence key; falls back to AG Grid) |
| 5.2–5.3 | `/api/health`, `render.yaml`, deploy runbook, architecture/demo-script/LICENSE docs |

## Days 5–6 (sponsor + submission, mostly user-side)

- 5.4 Register polish (row → detail links) and 5.5 dashboard metrics
  are the next code slices by value.
- 5.7+ (Studio Agent Framework / APIMatic plugin) needs sponsor
  access answers (AGENTS §16).
- Day 6: freeze, re-run the 3-minute demo flow (`docs/demo-script.md`),
  record/upload the video, Devpost submission.

## Pointers

- Standing engineering rules: `AGENTS.md`.
- Architectural decisions: `docs/adr/`.
- Verification receipts: `docs/verification-log.md`.
- Sandbox payout guide: `docs/paypal-sandbox.md`.
- Deploy runbook: `docs/deploy-runbook.md`.
