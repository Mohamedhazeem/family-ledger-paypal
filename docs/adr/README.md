# ADRs — FamilyLedger 2.0

Index of Architecture Decision Records. Each ADR is self-contained and traces to the authoritative spec `FamilyLedger_Spec_and_Build_Plan.md`.

| ADR | Title | Status | Spec refs |
|---|---|---|---|
| ADR-0001 | Single-deployable Next.js full-stack | Accepted | Part C §7–§8 |
| ADR-0002 | Prisma + PostgreSQL persistence | Accepted | Part C §7, §9 |
| ADR-0003 | Money: integer minor units | Accepted | Part C §7, §9, §12 |
| ADR-0004 | Two independent state machines | Accepted | Part A §4, Part C §10 |
| ADR-0005 | AI provider port, advisory-only | Accepted | Part C §12 |
| ADR-0006 | PayPal Payouts idempotency | Accepted | Part C §11 |
| ADR-0007 | Invitation token security | Accepted | Part C §13 |
| ADR-0008 | AES-256-GCM recipient encryption | Accepted | Part C §9, §13 |
| ADR-0009 | Append-only LedgerEvent | Accepted | Part C §9 |
| ADR-0010 | AG Studio analytics (fallback noted) | Accepted | Part D §14G |
| ADR-0011 | Thin Route Handlers, service layer | Accepted | Part C §8 |
| ADR-0012 | Mock vs sandbox modes | Accepted | Part C §11 |
| ADR-0013 | 300 LOC file-size policy | Accepted | Eng. policy |
| ADR-0014 | Testing strategy (TDD) | Accepted | Part E §17 |
| ADR-0015 | Env-only secrets | Accepted | Part C §13, §24 |
| ADR-0016 | Ports-and-Adapters for all third parties | Accepted | Part C §7 |
| ADR-0017 | Clean Architecture: Entities, Use Cases, Ports, Adapters, Frameworks | Accepted | Part C §7–§8 |
| ADR-0018 | Soft delete for never-sent drafts | Accepted | Part C §9, §13 |

## How to add a new ADR

1. Number sequentially (`ADR-NNNN`), never reuse. Create `docs/adr/ADR-NNNN.md` using the template in AGENTS.md §4/ADR template.
2. Set Status `Proposed` → after review `Accepted`; if replaced, set `Supersedes` and old ADR to `Superseded by ADR-XXXX`.
3. Cite spec Part/§ for every claim; record alternatives + guardrails + verification.
4. Update this README table and cross-link from `AGENTS.md §17`.
5. No decision is valid until its index entry exists and is consistent.

