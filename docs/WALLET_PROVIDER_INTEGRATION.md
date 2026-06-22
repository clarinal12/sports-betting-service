# Sportsbook wallet integration guide

**Audience:** Merchant / wallet service provider  
**Version:** 1.0  
**Last updated:** 2026-06-19

This document describes what your wallet API must implement so the **sports-betting-service** can debit player balances on bet placement and credit or finalize balances on settlement.

The sportsbook does **not** hold player funds. It calls your HTTP API as the system of record for balances and ledger movements.

---

## 1. Summary

| Endpoint | When we call it | Purpose |
|----------|-----------------|---------|
| `POST {baseUrl}/balance` | Before bet placement; player UI balance display | Read current balance |
| `POST {baseUrl}/transaction` | Bet debit; staff void refund | Single wallet movement |
| `POST {baseUrl}/batch-transactions` | After bets are graded (WON / LOST / VOID) | Settle many bets in one atomic batch |

**Authentication:** HTTP Basic on every request.

**Idempotency:** Required on all transaction endpoints via `transactionCode` (and `batchId` for batches).

---

## 2. Onboarding (per merchant / casino group)

For each merchant tenant we configure:

| Setting | Description |
|---------|-------------|
| `walletApiUrl` | Base URL of your API, e.g. `https://wallet.example.com/api` (no trailing slash required) |
| `merchantId` | Merchant identifier used in Basic auth username |
| `sportsSecret` | Shared secret used in Basic auth password |
| `currency` | ISO currency code for the tenant (e.g. `USD`) |

We store `sportsSecret` encrypted. You receive `merchantId` and `sportsSecret` once at onboarding.

---

## 3. Authentication

Every request includes:

```http
Authorization: Basic base64(merchantId:sportsSecret)
Content-Type: application/json
```

Example: if `merchantId = acme-merchant` and `sportsSecret = s3cr3t`, send:

```http
Authorization: Basic YWNtZS1tZXJjaGFudDpzM2NyM3Q=
```

---

## 4. Response envelope (all endpoints)

We expect a JSON body in this shape:

```json
{
  "success": true,
  "message": "optional string or number",
  "errorCode": 0
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `success` | boolean | `true` when the operation succeeded |
| `errorCode` | number | `0` = OK; non-zero = failure |
| `message` | string or number | On **balance**: current balance. On **transaction**: optional ledger reference id. On failure: human-readable reason |

### Success

```json
{
  "success": true,
  "message": "1234.56",
  "errorCode": 0
}
```

### Failure examples

**Insufficient balance (bet debit):**

```json
{
  "success": false,
  "message": "Insufficient balance",
  "errorCode": 1001
}
```

We also treat HTTP `402`, `409`, or `400` on debit as insufficient funds.

**Duplicate transaction (idempotent retry):**

```json
{
  "success": false,
  "message": "DUPLICATE transactionCode",
  "errorCode": 1002
}
```

If `message` contains the word `DUPLICATE` (case-insensitive), we treat the call as **success** and do not double-apply the movement.

### Timeouts

We use a **5 second** request timeout. Slow responses may cause retries with the same `transactionCode`.

---

## 5. `POST /balance`

Read the player's current wallet balance.

### Request

```json
{
  "userCode": "player_username"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `userCode` | string | Operator username (not internal user id) |

### Response (success)

```json
{
  "success": true,
  "message": "1000.00",
  "errorCode": 0
}
```

`message` must be a decimal balance string or number we can parse. Currency is taken from merchant config, not from this response.

### When we call it

- **Server:** before accepting a new bet (pre-check stake ≤ balance)
- **Player app:** periodically to show balance in the header (`GET /api/v1/wallet/balance` on our side proxies to your `/balance`)

---

## 6. `POST /transaction`

Apply a **single** wallet movement.

### Request body

```json
{
  "userCode": "player_username",
  "vendorCode": "sportsbook",
  "gameCode": "basketball_nba",
  "historyId": 284736192847,
  "roundId": "clxyz123betid",
  "gameType": 3,
  "transactionCode": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "isFinished": false,
  "isCanceled": false,
  "amount": -10.0,
  "detail": "Basketball · NBA · Lakers vs Celtics · MATCH RESULT · Lakers @ 2.100 · stake 10.00 USD",
  "createdAt": "2026-06-19T14:30:00.000Z"
}
```

### Field reference

| Field | Type | Description |
|-------|------|-------------|
| `userCode` | string | Player username |
| `vendorCode` | string | Always `"sportsbook"` |
| `gameCode` | string | League key from the bet, e.g. `basketball_nba`, `basketball_wnba` |
| `historyId` | number (long) | Stable numeric id for the **sporting event** (same event → same id across bets) |
| `roundId` | string | Our bet id — one betting slip / round |
| `gameType` | number | Always `3` (Other / sports betting) |
| `transactionCode` | string | **Unique idempotency key** for this wallet movement |
| `isFinished` | boolean | See lifecycle table below |
| `isCanceled` | boolean | `true` only for void / refund |
| `amount` | number | Negative = debit player; positive = credit; `0` = no balance change |
| `detail` | string | Human-readable description for support / statements |
| `createdAt` | string (ISO 8601) | When the bet or settlement was recorded |

### `isFinished` / `isCanceled` by operation

| Operation | `isFinished` | `isCanceled` | `amount` |
|-----------|--------------|--------------|----------|
| Bet placement (debit) | `false` | `false` | negative stake, e.g. `-10.00` |
| Settlement WON | `true` | `false` | positive payout |
| Settlement LOST | `true` | `false` | `0` |
| Settlement VOID | `true` | `true` | positive stake refund |
| Staff void refund | `true` | `true` | positive stake refund |

### Response (success)

```json
{
  "success": true,
  "message": "ledger-entry-id-optional",
  "errorCode": 0
}
```

If `message` is empty, we use `transactionCode` as the transaction reference.

### When we call it

1. **Bet debit** — immediately when a player places a bet (after balance pre-check)
2. **Staff void** — when an operator voids an accepted bet (stake refund), async with retries

Settlements (WON / LOST / VOID) are **not** sent on this endpoint in production; they use batch (section 7).

---

## 7. `POST /batch-transactions`

Apply **multiple settlement movements** in one request. Used after our system has graded bets in the database.

### Request body

```json
{
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "transactions": [
    {
      "userCode": "player1",
      "vendorCode": "sportsbook",
      "gameCode": "basketball_nba",
      "historyId": 284736192847,
      "roundId": "bet-id-won",
      "gameType": 3,
      "transactionCode": "stable-uuid-for-won-bet-id",
      "isFinished": true,
      "isCanceled": false,
      "amount": 25.5,
      "detail": "Basketball · NBA · Lakers vs Celtics · Bet WON · payout 25.50 USD · slip bet-id-won",
      "createdAt": "2026-06-19T18:00:00.000Z"
    },
    {
      "userCode": "player2",
      "vendorCode": "sportsbook",
      "gameCode": "basketball_nba",
      "historyId": 284736192847,
      "roundId": "bet-id-lost",
      "gameType": 3,
      "transactionCode": "stable-uuid-for-lost-bet-id",
      "isFinished": true,
      "isCanceled": false,
      "amount": 0,
      "detail": "Basketball · NBA · Lakers vs Celtics · Bet LOST · slip bet-id-lost",
      "createdAt": "2026-06-19T18:00:00.000Z"
    }
  ]
}
```

### Batch semantics (required)

| Requirement | Detail |
|-------------|--------|
| **All-or-nothing** | If any transaction in the batch cannot be applied, reject the **entire** batch (do not partially commit) |
| **Idempotent batch** | Retries use the same `batchId` and the same `transactionCode` per item |
| **Duplicate batch** | If the batch was already applied successfully, return success (same as duplicate single transaction) |
| **Per-item idempotency** | Each `transactionCode` must only affect the ledger once, even across batches |

### Response (success)

```json
{
  "success": true,
  "message": "optional",
  "errorCode": 0
}
```

We do not require per-transaction results in the response for MVP.

### When we call it

After a settlement run grades bets as WON, LOST, or VOID in our database, we enqueue wallet movements and flush them per merchant in batches. Failed batches are retried with exponential backoff (same `batchId` / `transactionCode`s).

---

## 8. Identifier rules

Understanding these ids is important for reconciliation and idempotency.

| Id | Scope | Stability | Example |
|----|-------|-----------|---------|
| `userCode` | Player | Operator username | `john_player` |
| `roundId` | One bet slip | Bet id (cuid) | `clx9abc...` |
| `transactionCode` | One wallet movement | See below | UUID |
| `historyId` | One sporting event | Deterministic hash of our `eventId` | `284736192847` |
| `batchId` | One settlement HTTP call | UUID per settlement run per merchant | `550e8400-...` |
| `gameCode` | Product / league | League key at placement | `basketball_nba` |

### `transactionCode` generation

| Movement | How we generate `transactionCode` |
|----------|-----------------------------------|
| Bet debit | Random UUID (stored before first send; retries reuse it) |
| Auto settlement WON / LOST / VOID | Stable UUID derived from `betId` + outcome (retries always identical) |
| Staff void | Stable UUID derived from `betId` (distinct from auto void) |

You **must** reject duplicate `transactionCode` with a DUPLICATE-style error, or return success if already applied.

### `historyId` derivation

We map each internal `eventId` to a stable positive 64-bit integer:

```
historyId = first 48 bits of SHA-256("wallet-history:" + eventId)
```

The same fixture/event always produces the same `historyId`, even across multiple bets.

---

## 9. End-to-end lifecycle

### 9.1 Bet placement

```
Player → Sportsbook POST /bets
           → Your POST /balance          (pre-check)
           → Your POST /transaction      (debit, isFinished=false, amount negative)
         ← Bet ACCEPTED or REJECTED
Player UI → Our GET /wallet/balance     (refresh after ACCEPTED)
```

If debit fails transiently, we retry with the same `transactionCode`. If insufficient funds, the bet is rejected.

### 9.2 Automatic settlement

```
Results ingested → Sportsbook grades bet (WON / LOST / VOID) in DB
                → Your POST /batch-transactions (all items for merchant)
                → On success: we mark wallet outbox complete
                → On failure: retry same batchId + transactionCodes
```

The bet is already settled in our database before the wallet call. Your API must be idempotent so retries are safe.

### 9.3 Staff void (accepted bet)

```
Operator voids bet → DB updated to VOID
                  → Your POST /transaction (refund, isFinished=true, isCanceled=true)
                  → Async retries until success
```

---

## 10. Amount and precision

- Amounts are sent as JSON **numbers** with up to 2 decimal places for USD-style currencies.
- Debits are **negative** (`-10.00`).
- Credits are **positive** (`25.50`).
- Lost bets: `amount = 0`, `isFinished = true` (round closed, no payout).

Use decimal-safe arithmetic on your side; do not rely on IEEE floating point for ledger storage.

---

## 11. `detail` string format

Free-text for support and statements. Typical patterns:

**Placement (single leg):**

```
Basketball · NBA · Lakers vs Celtics · MATCH RESULT · Lakers @ 2.100 · stake 10.00 USD
```

**Placement (accumulator):**

```
(1) Basketball · NBA · ... · (2) Basketball · WNBA · ... · stake 10.00 USD
```

**Settlement:**

```
Basketball · NBA · Lakers vs Celtics · Bet WON · payout 25.50 USD · slip {betId}
Basketball · NBA · Lakers vs Celtics · Bet LOST · slip {betId}
Basketball · NBA · Lakers vs Celtics · Bet VOID · stake refund 10.00 USD · slip {betId}
```

You do not need to parse `detail`; store it as-is for audit.

---

## 12. Error handling checklist

Please implement the following behaviors:

- [ ] **Balance:** return current balance in `message` when `errorCode = 0`
- [ ] **Debit:** reject when balance &lt; stake; non-zero `errorCode` or HTTP 402/409/400
- [ ] **Idempotency:** same `transactionCode` → no double debit/credit; return DUPLICATE or success
- [ ] **Batch atomicity:** partial batch failure rolls back entire batch
- [ ] **Batch retry:** same `batchId` + transaction list safe to replay
- [ ] **Duplicate detection:** `message` containing `DUPLICATE` treated as success by us
- [ ] **Latency:** respond within 5 seconds under normal load

---

## 13. Example sequences

### 13.1 Winning bet

1. **Debit** — `POST /transaction`  
   `amount: -10`, `isFinished: false`, `roundId: bet-001`

2. **Settle (batch)** — `POST /batch-transactions`  
   `amount: 25.50`, `isFinished: true`, `isCanceled: false`, `roundId: bet-001`

### 13.2 Losing bet

1. **Debit** — `amount: -10`, `isFinished: false`

2. **Settle (batch)** — `amount: 0`, `isFinished: true`, `isCanceled: false`

### 13.3 Void bet (auto — e.g. cancelled event)

1. **Debit** — `amount: -10`, `isFinished: false`

2. **Settle (batch)** — `amount: 10`, `isFinished: true`, `isCanceled: true`

---

## 14. Testing with our stack

1. Provide sandbox `walletApiUrl`, `merchantId`, and `sportsSecret`.
2. We configure a test merchant in the sportsbook back office.
3. Set `WALLET_PROVIDER=http` on the sportsbook service.
4. Verify:
   - Balance returns for a test `userCode`
   - Debit reduces balance and rejects insufficient funds
   - Duplicate `transactionCode` does not double-debit
   - Batch with 2+ settlements applies atomically
   - Batch retry with same `batchId` is idempotent

---

## 15. Contact / reconciliation

For production support, agree on:

- Sandbox and production base URLs per merchant
- Expected `errorCode` catalog (beyond `0` = OK)
- Whether you expose a separate reconciliation or transaction-history API (not required for MVP)
- Escalation when batch settlement fails repeatedly (we surface this in operator back office under **Settlement → Wallet transmission**)

---

## Document history

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-19 | Initial sportsbook wallet contract (balance, transaction, batch-transactions) |
