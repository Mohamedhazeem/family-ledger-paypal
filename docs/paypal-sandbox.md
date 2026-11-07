# PayPal sandbox (payouts) — setup and verification

Sandbox only. Live-money PayPal sending is out of scope for the MVP
(spec Part G §21). All credentials below are placeholders — real
values live in your untracked `.env` (`PAYPAL_CLIENT_ID`,
`PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`).

## 1. One-time setup

1. In the PayPal developer dashboard, create a **sandbox application** for
   your test business (or reuse the existing one).
2. Under **App settings → Granted scopes**, enable:
   `https://uri.paypal.com/payments/payouts`
3. Put the sandbox client id/secret in `.env`:
   `PAYPAL_CLIENT_ID=...`, `PAYPAL_CLIENT_SECRET=...`, `PAYPAL_ENV=sandbox`.
4. Seed or create a disbursement (a payout always uses its exact full
   amount in a single item, per spec §4.1).

## 2. PayPal-level curl flow (against the sandbox API)

### 2.1 OAuth token (Basic client credentials)

```bash
curl -s -u "$PAYPAL_CLIENT_ID:$PAYPAL_CLIENT_SECRET" \
  -X POST "https://api-m.sandbox.paypal.com/v1/oauth2/token" \
  -d "grant_type=client_credentials"
```

Expected 200:

```json
{
  "access_token": "EAAC... (opaque)",
  "token_type": "Bearer",
  "expires_in": 32400,
  "scope": "openid https://uri.paypal.com/payments/payouts ..."
}
```

FamilyLedger fails fast (actionable error) when the returned scope
does not include `https://uri.paypal.com/payments/payouts`.

### 2.2 Create a payout (one item, full amount, neutral note)

```bash
TOKEN=$(curl -s -u "$PAYPAL_CLIENT_ID:$PAYPAL_CLIENT_SECRET" \
  -X POST "https://api-m.sandbox.paypal.com/v1/oauth2/token" \
  -d "grant_type=client_credentials" | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "https://api-m.sandbox.paypal.com/v1/payments/payouts" \
  -d '{
        "sender_batch_header": {
          "sender_batch_id": "FL-BATCH-your-unique-id",
          "email_subject": "You received a family support payment"
        },
        "items": [{
          "recipient_type": "EMAIL",
          "receiver": "recipient.sandbox@example.com",
          "amount": { "value": "500.00", "currency": "USD" },
          "note": "Family support FL-YOUR-REFERENCE",
          "sender_item_id": "FL-BATCH-your-unique-id-ITM"
        }]
      }'
```

Expected 201:

```json
{
  "batch_header": {
    "payout_batch_id": "PAYOUT-BATCH-1",
    "batch_status": "PENDING"
  }
}
```

**Payout rules (spec §6 Step 8, AGENTS §5):** exactly one item for the
full amount; the note carries ONLY the `FL-` reference (no categories,
no private family notes); `sender_batch_id` is persisted in FamilyLedger
before this call and reused on retry — never regenerated.

### 2.3 Read batch + item status

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api-m.sandbox.paypal.com/v1/payments/payouts/PAYOUT-BATCH-1"
```

Expected 200:

```json
{
  "batch_header": {
    "payout_batch_id": "PAYOUT-BATCH-1",
    "batch_status": "SUCCESS"
  },
  "items": [{
    "sender_item_id": "FL-BATCH-...",
    "transaction_status": "UNCLAIMED"
  }]
}
```

**Batch status ≠ item delivery**: a `SUCCESS` batch can still contain an
`UNCLAIMED` item. FamilyLedger stores them separately and preserves
unknown statuses verbatim.

## 3. FamilyLedger-level flow (the same tools the app uses)

With the dev server running (`npm run dev`) and a coordinator session
cookie (obtained from `POST /api/auth/sign-in/email`):

```bash
# 1) Create a disbursement (writes Beneficiary + Disbursement + PlanVersion)
curl -s -b cookies.txt -X POST "http://localhost:3000/api/disbursements" \
  -H "content-type: application/json" -d '{
    "beneficiary": {
      "displayName": "Demo Beneficiary",
      "invitationEmail": "demo@example.com",
      "payPalRecipientEmail": "demo.paypal@example.com",
      "preferredLanguage": "en"
    },
    "amountText": "500.00",
    "currency": "USD",
    "supportNote": "Please allocate $300 for rent",
    "plan": { "summary": "Demo", "items": [{ "category": "Rent", "amountText": "300.00" }] }
  }'

# 2) Submit the payout (one sandbox batch, full amount)
curl -s -b cookies.txt -X POST "http://localhost:3000/api/disbursements/<DISBURSEMENT_ID>/pay"

# 3) Refresh payout + item statuses explicitly
curl -s -b cookies.txt "http://localhost:3000/api/disbursements/<DISBURSEMENT_ID>/payout-status"
```

A queued Postman equivalent lives at
`docs/postman/family-ledger.postman_collection.json` (sandbox only).

## 4. Failure guide

| Symptom | Meaning | Fix |
|---|---|---|
| `410 / 400 … invalid_receiver` | Receiver is not a sandbox-valid recipient | Use a registered sandbox receiver |
| `PayPal payouts failed with HTTP 400` | Definite rejection → our status `FAILED` | Correct the request and submit again |
| `STATUS_UNKNOWN` after a call | 5xx/timeout — outcome unknown | Re-POST `/pay`: the same `sender_batch_id` is reused; PayPal dedupes for 30 days |
| Missing Payouts scope error | App not granted payouts | Enable the scope in the dashboard (§1) |
| `MOCK PAYMENT` badge | Demo row in `MOCK` mode; no real call leaves the server | Only rows created with `paymentMode: MOCK` (seeded) |
