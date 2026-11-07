# FamilyLedger 2.0 — Architecture

Consent-first, AI-assisted family-support disbursement platform.
"Make the support plan clear before the money moves."

## Layers (Clean Architecture, ADR-0017)

```
src/domain        pure TS — entities, value objects, plan diff, payout
                  status, timeline visibility. No framework/SDK imports.
src/application   use cases + ports (Db, Ai, PayPal, Analytics).
                  Imports only domain + ports.
src/infrastructure  adapters: Prisma (db), OpenAI-compatible AI,
                  PayPal sandbox OAuth+payouts, analytics, auth.
                  The ONLY place vendor SDKs are imported (server-only).
src/app           thin route handlers + server components (presenters).
src/components    client components (forms, buttons, AG Grid register).
src/lib           shared libs: security (encryption, rate limit), i18n,
                  money formatting.
```

Dependency direction: `domain → application → infrastructure →
frameworks`. Route handlers validate (Zod), call one use case, and
present — no business rules in handlers.

## Key decisions (see docs/adr/ for the full set)

- **ADR-0017** Clean Architecture (Entities/Use Cases/Ports/Adapters).
- **ADR-0016** Hexagonal seam for every integration (env-swappable).
- **ADR-0004/§10** Plan and payment are independent state machines.
- **ADR-0005/12** AI behind the AiProvider port; structured JSON + Zod;
  diffs computed deterministically in code.

## Non-negotiables (spec Part A §4)

1. The payout amount is the full disbursement amount — never split by
   category. One PayPal item, one transfer, neutral `FL-` note.
2. Categories live in FamilyLedger, never in a PayPal `purpose_tag`.
3. A category change never triggers another payout.
4. Beneficiary consent is voluntary and never gates payment.
5. `BENEFICIARY_DECLINED_TO_SHARE` still allows payout.
6. No spending surveillance, no receipts, no scoring.
7. AI is advisory only — it cannot approve, initiate, or change a payout.
8. Every payment action needs an explicit coordinator confirmation.
9. Sandbox only; synthetic data only. Not a live remittance service.
