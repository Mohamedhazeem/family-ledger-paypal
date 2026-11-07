# Demo script (3-minute talk track)

> Run-order for the judge demo. Every step works against the live
> sandbox build (dev or Render). The PayPal payout actually arrives
> as a sandbox batch; nothing here moves real money.

## 0:00 — The pitch

"FamilyLedger makes the support plan clear **before the money moves**
one unrestricted PayPal payout, always — a voluntary shared plan, not a restriction."

## 0:20 — Coordinator flow (live)

1. Sign in as the seeded coordinator (README credentials).
2. **New disbursement**: beneficiary, emails, $500, note "Please
   allocate $300 for rent, $150 for school fees and $50 for food."
3. **Extract plan** (AI) → 3 editable categories, sum updates live.
   Show the over-total block by editing an amount past the total.
4. **Save** → the row lands in the register (`PENDING` sources later).

## 1:10 — Beneficiary flow (mobile view)

5. **Create invocation** (copyable link) → open it on the phone view.
6. Page shows programme, $500.00, the 3 categories, consent statement.
   Try the **Tamil switcher** — labels localize; amounts never change.
7. **Suggest changes** (Rent $300 → $250, add Medicine $50) with the
   "School starts next month" explanation → sends a new PlanVersion.

## 1:50 — The coordinator side again

8. **Compare screen**: v1 vs v2 side by side, deterministic diff text
   (`~ Rent: $300.00 → $250.00 (−$50.00)`, `+ Added Medicine`) and the
   neutral AI explanation. Honest nuance: "The diff itself is computed
   in deterministic code — the AI only ever explains it."
9. **Acknowledge**, then the other side: **Decline/Accept flows** are
   visible on the portal.
10. **Send full payment** (explicit button, enabled even before
    acknowledgement) → one sandbox payout, full $500.
11. **Refresh status** → badges: batch `SUCCESS` + item `UNCLAIMED` —
    "a batch SUCCESS can still contain an unclaimed item; we store
    both and never equate them."

## 2:30 — Closing proof points

12. **Analytics**: aggregate-only workspace (AG Studio or labelled
    fallback).
13. One-line recap: "Consent-first, AI-assisted, one payout, dual
    state, append-only history."

## Video checklist

- [ ] ≥1920×1080, under 3:00 total.
- [ ] Captions on key clicks (no voiceover required).
- [ ] Show the sandbox batch id + PayPal status page.
- [ ] No real PII or real recipient emails on screen.
