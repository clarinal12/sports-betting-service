<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

Sports betting backend: live events, schedules, markets, and odds — multi-tenant by casino group, with user identity and balance from an external service. Future: industry-standard operator back office (trading, product, bet ops, analytics) per casino.

**Design & implementation plan:** [docs/DESIGN.md](docs/DESIGN.md)

Built with [NestJS](https://nestjs.com/).

## Project setup

```bash
npm install
cp .env.example .env
npm run docker:up
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```

`db:seed` loads catalog + schedule from **The Odds API** when
`FIXTURE_PROVIDER=odds-api` in `.env`, then creates demo casino groups. To wipe and
reload from scratch:

```bash
npm run db:reset
```

To refresh odds/schedule only (keeps groups): `npm run ingest:fixtures`. With
`FIXTURE_PROVIDER=odds-api`, catalog ingest **upserts only** (no stale-fixture purge).
Mock ingest removes stale `mock_*` fixtures not in the snapshot (skipping any with bets).

To refresh **live scores and in-play odds** only (cheap; scoped to LIVE fixtures
already in the DB): `npm run ingest:live`. Run `ingest:fixtures` first so the
catalog exists.

**Recommended schedulers** (copy from [`.env.example`](.env.example) for odds-api + real bets):

| Kind | Enable | Cadence |
|------|--------|---------|
| **Results + settle** | `RESULTS_INGEST_ENABLED=true` | `RESULTS_INGEST_POLL_SECONDS=120` |
| Catalog (schedule) | `INGEST_CATALOG_ENABLED=false` or cron | `INGEST_CATALOG_CRON=0 */6 * * *` |
| Live (in-play UI only) | `INGEST_LIVE_ENABLED=false` until needed | `INGEST_LIVE_INTERVAL_SECONDS=60` |
| Settle-only worker | `SETTLEMENT_ENABLED=false` | (included in results tick) |

**Automatic ingest** (while the API is running):

| Kind | Enable | Cadence (recommended) |
|------|--------|------------------------|
| **Results + settle** | `RESULTS_INGEST_ENABLED=true` | `RESULTS_INGEST_POLL_SECONDS=120` |
| Live | `INGEST_LIVE_ENABLED=true` when testing live book | `INGEST_LIVE_INTERVAL_SECONDS=60` |
| Catalog | `INGEST_CATALOG_ENABLED=true` | `INGEST_CATALOG_CRON=0 */6 * * *` (every 6h) |

Both schedulers use a Redis lock (no double-poll across instances) and pause when
The Odds API returns 401 or `x-requests-remaining` drops below
`INGEST_ODDS_API_REMAINING_MIN` (default `20`). Run `ingest:fixtures` once after
deploy if you need data before the first cron fire.

### Fixture provider (Phase 3c)

Set `FIXTURE_PROVIDER=odds-api` and `ODDS_API_KEY` in `.env` to pull live data from
[The Odds API](https://the-odds-api.com). Markets: `h2h`, `spreads`, `totals`
→ internal `MATCH_RESULT`, `HANDICAP`, `TOTAL`. Decimal odds preserved as strings.

| Variable | Default | Purpose |
|----------|---------|---------|
| `FIXTURE_PROVIDER` | `mock` | `mock` or `odds-api` |
| `ODDS_API_KEY` | — | Required when provider is `odds-api` |
| `ODDS_API_SPORT_KEYS` | `basketball_nba` | Group aliases or `all` |
| `ODDS_API_REGIONS` | `all` | `all` → us, us2, uk, eu, au; or comma-separated subset |
| `ODDS_API_MARKETS` | `h2h,spreads,totals` | Upstream market keys |
| `INGEST_LIVE_ENABLED` | `false` | In-process live ingest scheduler |
| `INGEST_LIVE_INTERVAL_SECONDS` | `60` | Tick interval when live scheduler enabled |
| `INGEST_CATALOG_ENABLED` | `false` | In-process full catalog ingest scheduler |
| `INGEST_CATALOG_CRON` | `0 */6 * * *` | Cron for catalog ingest (5-field) |
| `INGEST_LIVE_PRESTART_MINUTES` | `15` | Include soon-to-start fixtures on live ticks |
| `INGEST_ODDS_API_REMAINING_MIN` | `20` | Pause scheduler when quota below this |
| `INGEST_ODDS_API_PAUSE_MINUTES` | `30` | Pause duration after low quota or 401 |

`all` ingests every **active game sport** from `/sports`. Demo tenant offerings:
**acme** and **betzone** both expose **NBA only** (`basketball_nba`).

After switching from mock, run `npm run db:reset` once to drop stale data and
reload from The Odds API.

E2E tests force `FIXTURE_PROVIDER=mock`. Response quota is logged via
`x-requests-remaining` / `x-requests-used` headers after each API call.

## Compile and run the project

```bash
# development (watch)
npm run start:dev

# production
npm run build && npm run start:prod
```

## Verify Phase 0

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness |
| `GET /ready` | Postgres + Redis |
| `GET /api/v1` | Service metadata |
| `GET /api/docs` | Swagger UI |

## Authentication (Phase 3a)

Players enter via an operator **launch token** (JWT signed HS256 with that
merchant's `sportsSecret`). The service verifies it and issues a short-lived
**session token** used on all subsequent calls.

```
GET /api/v1/launch?token=<operatorJWT>   →  { sessionToken, expiresIn, user }
# then:
Authorization: Bearer <sessionToken>     on every player request
```

The verified token's `merchantId` resolves the tenant (`currency` comes from the
group config). Missing/invalid session → `401`; unknown/inactive group → `403`.

For local development you can mint a launch token and (when
`AUTH_ALLOW_HEADER_FALLBACK=true`) still use the `X-Casino-Group` slug header
without a token:

```bash
npm run dev:token -- --merchant acme-merchant --user player-7 --username bob
```

## Real-time (Phase 3b)

WebSocket namespace **`/realtime`** (Socket.IO). Authenticate with the **session
token** from `/launch` in the handshake (`auth: { token: sessionToken }`).

After connect, emit **`subscribe`** with event and/or market ids (tenant-scoped).
Server pushes:

| Event | When |
|-------|------|
| `event.update` | Score, clock, or status changes after ingestion |
| `selection.odds` | Selection price changes |

Rooms are namespaced per group: `group:{casinoGroupId}:event:{id}` and
`group:{casinoGroupId}:market:{id}`. Updates fan out across app instances via
Redis pub/sub. Socket.IO heartbeat handles reconnects; re-subscribe after
reconnect.

Subscribe rate limit: `REALTIME_SUBSCRIBE_MAX_PER_MINUTE` per casino group
(default `60`).

```javascript
import { io } from 'socket.io-client';
const socket = io('http://localhost:3001/realtime', {
  auth: { token: sessionToken },
});
socket.on('connected', () => {
  socket.emit('subscribe', { eventIds: ['<eventId>'], marketIds: ['<marketId>'] });
});
socket.on('event.update', (payload) => console.log(payload));
socket.on('selection.odds', (payload) => console.log(payload));
```

Run `npm run ingest:fixtures` for a one-off catalog refresh, `npm run ingest:live` for a
one-off live tick, or enable `INGEST_CATALOG_ENABLED` / `INGEST_LIVE_ENABLED` for
scheduled ingest while the API runs. All paths trigger WebSocket pushes when scores
or prices change. The player shell `/live` page subscribes to those updates when signed in.

## Player API (Phase 1)

All player endpoints are tenant-scoped. Authenticate with a `Bearer` session
token, or (dev only) the `X-Casino-Group` slug header.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/sports` | Sports offered to the group |
| `GET /api/v1/leagues?sportId=` | Leagues enabled for the group |
| `GET /api/v1/fixtures?from=&to=&leagueId=&status=&page=&pageSize=` | Schedule (paginated) |
| `GET /api/v1/events/live` | Live events (status, score, clock) |
| `GET /api/v1/events/:id` | Event detail + live state |
| `GET /api/v1/events/:id/markets` | Markets + selections with odds |
| `GET /api/v1/markets/:id` | Single market |
| `POST /api/v1/bets` | Place bet (session + `Idempotency-Key` header) |
| `GET /api/v1/bets` | List bets for the authenticated player |
| `GET /api/v1/bets/:id` | Bet detail |

Decimal odds are returned as **strings** (e.g. `"1.95"`) to preserve precision.

### Betting (Phase 4)

1. Exchange operator launch token: `GET /api/v1/launch?token=...` → `sessionToken`
2. Place bet: `POST /api/v1/bets` with `Authorization: Bearer <sessionToken>` and header `Idempotency-Key: <uuid>`

```json
{ "selectionIds": ["<selectionId>"], "stake": "10.00" }
```

Local dev uses `WALLET_PROVIDER=stub` (default balance `WALLET_STUB_BALANCE`). Production integrates `POST /wallet/reserve` on the user service when `WALLET_PROVIDER=http`. Failed wallet debits are retried via the wallet outbox worker (`WALLET_OUTBOX_POLL_SECONDS`).

#### Bet leg snapshot (at placement)

Each accepted leg stores a **frozen copy** of what the player bet on: `marketType`, `marketLine` (handicap/totals), `homeTeamName`, `awayTeamName`, and `eventProviderRef`. These are written automatically on `POST /api/v1/bets` and returned on `GET /api/v1/bets` / `GET /api/v1/bets/:id`.

Settlement uses the snapshot for **grading rules** (which market type, which team names, which line) while still reading **live** `Event` scores and `Market` status from the DB after results ingest. That way a later catalog rename or selection delete does not change how an old bet is settled. Bets placed before this migration have null snapshot fields and fall back to the current selection/market join.

### Settlement (Phase 4.5)

When all legs are on **ENDED** events with **SETTLED** (or **VOID**) markets, accepted bets are graded and wallet credits are applied:

- **WON** — credits `potentialPayout` (`WIN`)
- **LOST** — no credit
- **VOID** — refunds stake (`REFUND`)

#### Results ingest (bet-driven — use this)

`ingest:fixtures` is **catalog/pricing only**. To settle real bets, refresh **results for open bets** then grade:

```bash
npm run ingest:results
```

This calls The Odds API `GET /scores` with `eventIds` from **ACCEPTED** bets (`daysFrom` = `ODDS_API_SCORES_DAYS_FROM`, default `3`), updates events in the DB, flags overdue bets, then runs settlement.

Automatic (while API is running):

```env
RESULTS_INGEST_ENABLED=true
RESULTS_INGEST_POLL_SECONDS=120
```

`ingest:live` still helps for live odds/scores on the live slate; **results ingest** is what ties settlement to your actual liabilities.

#### Manual result (feed gap)

When The Odds API no longer returns an event on `/scores` (common for some MiLB games), set the result yourself then settle:

```bash
npm run result:manual -- --event <eventProviderRef> --home 3 --away 2
npm run settle   # optional if not using ingest:results
```

Find `eventProviderRef` on the bet leg (`legs[].eventProviderRef`) or in Prisma Studio (`events.providerRef`).

#### Settle only

`npm run settle` — grades bets already **ENDED** + **SETTLED** in the DB. Optional scheduler: `SETTLEMENT_ENABLED=true`.

Bet responses include `payoutAmount`, `settledAt`, `settlementNote` (when awaiting results), and per-leg `outcome` when settled.

### API playground

[`requests.http`](requests.http) contains every endpoint (plus the
`400`/`403`/`404` guardrail checks) ready to run with the **REST Client**
extension (VS Code / Cursor) or a JetBrains IDE — click "Send Request" above any
request. Event/market IDs are chained automatically, so no copy-pasting IDs.

```bash
curl -H "X-Casino-Group: acme" http://localhost:3001/api/v1/sports
curl -H "X-Casino-Group: betzone" "http://localhost:3001/api/v1/fixtures?pageSize=5"
```

### Hardening (Phase 5)

| Endpoint / doc | Purpose |
|----------------|---------|
| `GET /metrics` | Prometheus scrape (`METRICS_ENABLED=true`) |
| [docs/RUNBOOKS.md](docs/RUNBOOKS.md) | Upstream outage, stale odds, suspend market |
| `npm run test:integration` | Postgres + audit smoke (Testcontainers, Docker required) |
| `npm run load:realtime -- --token <sessionJWT> --clients 50` | WS connection smoke test |

Apply migration: `npx prisma migrate deploy` (includes `audit_log_entries`).

MVP decisions: [docs/DECISIONS.md](docs/DECISIONS.md). Full design: [docs/DESIGN.md](docs/DESIGN.md).

If port `3001` is in use, set `PORT` in `.env` to a free port before `npm run start:dev`.

### Dev DB vs tests

`npm run test:e2e` forces `FIXTURE_PROVIDER=mock` and runs a full catalog ingest on
`DATABASE_URL`. Mock ingest only purges stale `mock_*` rows (never odds-api fixtures).
Odds-api ingest never purges. You should still point e2e at a separate database when
developing with real odds data:

```bash
# create once: createdb -U sports sports_betting_test  # or via docker
TEST_DATABASE_URL=postgresql://sports:sports@localhost:5432/sports_betting_test npm run test:e2e
```

`start:dev` does **not** run catalog ingest on boot; scheduled ingest only fires on the
cron (`INGEST_CATALOG_CRON`). The live scheduler (`INGEST_LIVE_ENABLED`) runs `ingest:live`
immediately on startup and does not replace the catalog with mock data.

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
