# MVP decisions (Day 1)

Locked choices for the first implementation phases. Update this file when decisions change.

| Topic | Decision | Notes |
|-------|----------|-------|
| v1 player scope | **Odds display + bet placement** | Settlement and back office in later phases |
| ORM | **Prisma 6** | PostgreSQL (`DATABASE_URL` in schema); Prisma 7 deferred |
| Odds provider (dev) | **Mock adapter first** | Real provider integrated in Phase 1–2 |
| Player identity | **External user service** | JWT/JWKS in Phase 3; not built locally |
| Back office | **Deferred** | Phase 6; design in `DESIGN.md` |
| TimescaleDB | **Deferred** | Add with odds history in Phase 2 |
| Message queue | **Deferred** | BullMQ when scheduled ingestion lands |

## Phase 1 decisions

| Topic | Decision | Notes |
|-------|----------|-------|
| Catalog model | **Global `Sport`/`League` + per-tenant enablement** | `CasinoGroupLeague` join controls offering |
| Tenant resolution | **`X-Casino-Group` header = group slug** | Swapped for player JWT claim in Phase 3 |
| Primary keys | **`cuid()`** | Stable, URL-safe |
| Provider abstraction | **`FixtureProviderPort` + `MockFixtureProvider`** | Real provider = new adapter, ingestion unchanged |
| Ingestion | **Manual (`ingest:fixtures`), idempotent upserts by key/providerRef** | Scheduled ingestion deferred |
| Tenant scoping | **Enforced in the data layer** | Services filter by `casinoGroupId`, never trust query input |

## Phase 2 decisions

| Topic | Decision | Notes |
|-------|----------|-------|
| Live model | **`Event` 1:1 with `Fixture`; `Market` → `Selection`** | Event adds status/score/clock |
| Odds history | **Current price on `Selection` + `OddsSnapshot` table in plain Postgres** | TimescaleDB hypertable deferred; snapshot written only on price change |
| Price type | **Prisma `Decimal` (numeric), `decimal.js`; serialized as strings in JSON** | Never a JS `number` (FR-M6) |
| Market types (MVP) | **MATCH_RESULT, TOTAL; + BOTH_TEAMS_SCORE (soccer), HANDICAP (basketball)** | Provider maps foreign codes → `MarketType` enum |
| Per-group market rules (FR-M4) | **Deferred** | All market types exposed to every group for now |
| Event/market scoping | **Via fixture → league → enabled group** | Cross-tenant access returns 404 |

## Phase 4 decisions

| Topic | Decision | Notes |
|-------|----------|-------|
| Bet leg snapshot | **Freeze `marketType`, `marketLine`, team names, `eventProviderRef` on `BetLeg` at placement** | Settlement grades from snapshot + live scores/market status; legacy legs without snapshot fall back to current `Selection`/`Market` join |

## Phase 6 decisions (6.1–6.8 API)

| Topic | Decision | Notes |
|-------|----------|-------|
| Staff identity | **Local `StaffUser` + argon2 + refresh sessions** | OIDC deferred; separate `STAFF_JWT_SECRET` from player session |
| RBAC | **Role → permission map** (`OPERATOR_ADMIN`, `TRADER`, …) | `@RequirePermission()` on routes |
| Merchant onboarding | **`POST /backoffice/merchants`** encrypts `sportsSecret`, enables leagues, audits | Plaintext secret returned once in response |
| Platform vs tenant staff | **`casinoGroupId` null** = cross-tenant platform operator | Tenant staff scoped to one group |
| Trading | **Suspend event/market via DB status + audit** | Resume market when event not ENDED |
| Bet void | **Staff `POST …/void` refunds stake, sets VOID** | ACCEPTED only; audited |
| Analytics MVP | **On-demand `groupBy` on bets** | Daily rollups deferred |

## Phase 5 decisions

| Topic | Decision | Notes |
|-------|----------|-------|
| Metrics | **Prometheus via `prom-client` on `GET /metrics`** | `METRICS_ENABLED`; default Node/process metrics prefixed `sbs_` |
| Tracing | **OpenTelemetry deferred** | Add when exporting to a shared observability stack |
| Audit log | **`audit_log_entries` append-only table + `AuditService`** | System actor on ingestion offering sync; staff actor in Phase 6 |
| Integration tests | **Optional `npm run test:integration` with Testcontainers Postgres** | Gated by `INTEGRATION_TEST=1` |
| Runbooks | **`docs/RUNBOOKS.md`** | Upstream outage, stale odds, market suspend |

## Environment

Copy `.env.example` to `.env` and start infrastructure:

```bash
cp .env.example .env
docker compose up -d
```
