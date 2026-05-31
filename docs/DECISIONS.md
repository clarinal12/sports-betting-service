# MVP decisions (Day 1)

Locked choices for the first implementation phases. Update this file when decisions change.

| Topic | Decision | Notes |
|-------|----------|-------|
| v1 player scope | **Odds display only** | Bet placement and wallet reserve in Phase 4 |
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

## Environment

Copy `.env.example` to `.env` and start infrastructure:

```bash
cp .env.example .env
docker compose up -d
```
