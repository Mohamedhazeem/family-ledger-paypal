# Tech Stack Decisions (ADR-style entries)

Companion to `docs/tech-stack.md`. Each entry cites its spec section. Read with AGENTS.md and `docs/adr/`.

## 1. Better Auth primary over Auth.js v5
- Spec: Part C §7 (Auth.js Credentials **or** equivalent simple session solution), Part C §13, Part F Day 1.
- Decision: Better Auth (email/password, Prisma adapter) because it is Prisma-native and stable. Auth.js v5 fallback only if Better Auth cannot meet session/role requirements.
- Alternatives: Auth.js v5 — deferred, fallback. Rejected as primary because Prisma adapter ergonomics are weaker for the seeded judge account.
- Guardrail: HttpOnly SameSite cookies, server-side session checks on every operator route, seeded judge account.

## 2. TypeScript 5.9.3 over 7.0.2
- Spec: Part C §7.
- Decision: Pin 5.9.3 despite npm latest 7.0.2 because typescript-eslint does not support TS 7.0 (warning + crash at lint time). Keeps `npm run lint` green for the 6-day window. Upgrade when TS ≥7.1 ships.
- Alternatives: 7.0.2 — rejected: breaks ESLint CI.

## 3. Prisma 7.10.1 over 8.0.0-rc.30
- Spec: Part C §7, §9.
- Decision: Pin stable 7.10.1. 8.0.0-rc.30 is a release candidate — avoid RC for hackathon stability. Prisma 8 to be evaluated post-demo.
- Alternatives: 8 RC — rejected for stability.

## 4. BigInt for money minor units over Int
- Spec: Part C §7, §9 (`amountMinor` integer/BigInt), Part B §Step 2, ADR-0003.
- Decision: PostgreSQL `BigInt` for `amountMinor`. Programme-level aggregates across many disbursements exceed comfortable Int ranges and JSON number precision.
- Alternatives: Int — rejected for aggregate safety. Float dollars — banned.

## 5. AG Studio 3 server-side LLM proxy
- Spec: Part D §14G, Part F Day 5, ADR-0010.
- Decision: Default harness + LLM adapter proxied server-side; API key never exposed to client. Agents/tools query aggregate-only views.
- Alternatives: Client-side key — rejected (secret exposure). Plain AG Grid only — fallback only, honest trade-off recorded.

## 6. PayPal adapter thinness (no SDK leak)
- Spec: Part C §11, ADR-0006, ADR-0016.
- Decision: Single server-only module imports PayPal vendor package; business code depends only on port DTOs. `sender_batch_id` persisted BEFORE call, reused on 5xx/timeout, never regenerated.
- Alternatives: SDK types in services — rejected (lock-in).

## 7. @t3-oss/env-nextjs over hand-rolled Zod env
- Spec: Part C §13, §24, ADR-0015.
- Decision: @t3-oss/env-nextjs in `src/env.ts` imported by `instrumentation.ts`, fails fast with readable error. Services never read `process.env` directly.
- Alternatives: Manual Zod file — viable fallback if @t3-oss/env-nextjs cannot meet a requirement, with same fail-fast behavior.

## 8. pino over console
- Spec: Part C §13 (redacted logs).
- Decision: pino with explicit redaction list (authorization, cookie, paypal*secret*, *_token, receiver, free-text notes). `no-console` enforced in `src/services/**`.
- Alternatives: console.log — banned in services.

## 9. Tailwind v4 CSS-first (no tailwind.config.*)
- Spec: Part C §7.
- Decision: Tailwind v4 with `@import "tailwindcss"`. Must verify shadcn CLI works with Next 16.4.5 before generating components.
- Alternatives: Tailwind v3 + tailwind.config.* — rejected (Next 16 / modern CSS-first path).

## 10. MSW for AI/PayPal mocking
- Spec: Part E §17, ADR-0014.
- Decision: MSW 3.0.4 for network mocking in Vitest (unit + service integration). MockPayPalAdapter distinct from Sandbox.
- Alternatives: Hand stubs — rejected for realism.

## 11. proxy.ts over middleware.ts (Next 16)
- Spec: Part C §7 (Next.js App Router).
- Decision: Use `proxy.ts` for edge/middleware concerns per Next 16; `middleware.ts` is not used.
- Alternatives: middleware.ts — legacy in Next 16.

