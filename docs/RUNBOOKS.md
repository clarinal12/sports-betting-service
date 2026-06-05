# Operations runbooks (Phase 5)

Quick response guides for on-call. Assumes Docker Postgres/Redis and the API on port `3001`.

## Health checks

```bash
curl -s http://localhost:3001/health
curl -s http://localhost:3001/ready
curl -s http://localhost:3001/metrics   # when METRICS_ENABLED=true
```

`/ready` failing → fix Postgres (`DATABASE_URL`) or Redis (`REDIS_URL`) before player traffic.

---

## 1. Upstream Odds API outage or quota exhaustion

**Symptoms**

- Logs: `Odds API`, HTTP 401/429, ingest paused messages
- `sbs_ingestion_runs_total{outcome="error"}` increasing
- Stale odds; `x-requests-remaining` near zero

**Steps**

1. Confirm provider status and API key: `ODDS_API_KEY`, `FIXTURE_PROVIDER=odds-api`.
2. Check quota env: `INGEST_ODDS_API_REMAINING_MIN`, `INGEST_ODDS_API_PAUSE_MINUTES`.
3. Pause expensive jobs temporarily:
   - `INGEST_CATALOG_ENABLED=false`
   - `INGEST_LIVE_ENABLED=false`
   - `RESULTS_INGEST_ENABLED=false`
4. Restart API after key rotation if 401.
5. Run manual catch-up when healthy:
   ```bash
   npm run ingest:fixtures
   npm run ingest:results
   ```
6. Communicate to operators: display-only degradation; do not place bets on obviously stale prices if markets are `SUSPENDED`.

**Prevention**

- Monitor `sbs_ingestion_duration_seconds` and provider remaining quota logs.
- Use `ODDS_API_SPORT_KEYS=basketball_nba` (or minimal set) to limit burn.

---

## 2. Stale odds / scores (events not updating)

**Symptoms**

- Live page frozen; no `selection.odds` / `event.update` WS events
- Events stuck `LIVE` with null scores
- ACCEPTED bets not settling; `settlementNote` set

**Steps**

1. Verify ingest workers:
   - `INGEST_LIVE_ENABLED=true` for in-play prices, or cron `ingest:live`
   - `RESULTS_INGEST_ENABLED=true` for bet-driven `/scores`
2. Run CLI manually:
   ```bash
   npm run ingest:live
   npm run ingest:results
   ```
3. Inspect DB (Prisma Studio): `events.status`, `homeScore`/`awayScore`, `markets.status`.
4. If provider dropped the event (common for some leagues):
   ```bash
   npm run result:manual -- --event <eventProviderRef> --home 3 --away 2
   npm run settle
   ```
5. Check WebSocket: client must use **session** token from `/launch`, not launch token.

---

## 3. Suspend a market or event (stop betting)

**Symptoms**

- Trading/risk request to halt a fixture; players still see OPEN markets

**Steps (database — until Phase 6 back office UI)**

1. Identify `eventId` / `marketId` in Prisma Studio or API.
2. Suspend market:
   ```sql
   UPDATE markets SET status = 'SUSPENDED' WHERE id = '<marketId>';
   ```
3. Or end event (also closes markets on next ingest for ENDED):
   ```sql
   UPDATE events SET status = 'SUSPENDED' WHERE id = '<eventId>';
   ```
4. Bet placement validates `MarketStatus.OPEN` and `SelectionStatus.OPEN` — suspended legs reject new bets.
5. Document action; Phase 5+ audit for staff mutations will land in Phase 6 (`staff` actor).

**After Phase 6**

- Use back-office `trading.suspend` with reason code (audited).

---

## 4. Wallet / bet placement degraded

**Symptoms**

- Bets stuck `PENDING`; wallet outbox retries in logs
- `WALLET_PROVIDER=http` errors

**Steps**

1. Check user service: `USER_SERVICE_BASE_URL`, reserve endpoint health.
2. Inspect `wallet_outbox` for `lastError`, `nextRetryAt`.
3. `WALLET_OUTBOX_POLL_SECONDS` controls retry cadence.
4. Players can retry with the **same** `Idempotency-Key` once wallet is healthy.

---

## Metrics reference

| Metric | Meaning |
|--------|---------|
| `sbs_http_requests_total` | API traffic by route/status |
| `sbs_bets_placed_total{status}` | Bet placements |
| `sbs_bets_settled_total{result}` | WON/LOST/VOID settlements |
| `sbs_ingestion_runs_total{kind,outcome}` | catalog/live ingest outcomes |
| `sbs_ws_connections_active` | Realtime connections |

OpenTelemetry tracing is deferred; export Prometheus to Grafana or scrape `/metrics` directly.
