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

To refresh odds/schedule only (keeps groups): `npm run ingest:fixtures`.

To refresh **live scores and in-play odds** only (cheap; scoped to LIVE fixtures
already in the DB): `npm run ingest:live`. Run `ingest:fixtures` first so the
catalog exists.

**Automatic ingest** (while the API is running):

| Kind | Enable | Cadence (recommended) |
|------|--------|------------------------|
| Live | `INGEST_LIVE_ENABLED=true` | `INGEST_LIVE_INTERVAL_SECONDS=60` |
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
| `ODDS_API_SPORT_KEYS` | `basketball,baseball,americanfootball,soccer` | Group aliases or `all` |
| `ODDS_API_REGIONS` | `all` | `all` → us, us2, uk, eu, au; or comma-separated subset |
| `ODDS_API_MARKETS` | `h2h,spreads,totals` | Upstream market keys |
| `INGEST_LIVE_ENABLED` | `false` | In-process live ingest scheduler |
| `INGEST_LIVE_INTERVAL_SECONDS` | `60` | Tick interval when live scheduler enabled |
| `INGEST_CATALOG_ENABLED` | `false` | In-process full catalog ingest scheduler |
| `INGEST_CATALOG_CRON` | `0 */6 * * *` | Cron for catalog ingest (5-field) |
| `INGEST_LIVE_PRESTART_MINUTES` | `15` | Include soon-to-start fixtures on live ticks |
| `INGEST_ODDS_API_REMAINING_MIN` | `20` | Pause scheduler when quota below this |
| `INGEST_ODDS_API_PAUSE_MINUTES` | `30` | Pause duration after low quota or 401 |

`all` ingests every **active game sport** from `/sports`. Tenant offerings: **acme**
gets basketball, baseball, american football, and soccer (all leagues, all regions);
**betzone** gets basketball only.

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

Decimal odds are returned as **strings** (e.g. `"1.95"`) to preserve precision.

### API playground

[`requests.http`](requests.http) contains every endpoint (plus the
`400`/`403`/`404` guardrail checks) ready to run with the **REST Client**
extension (VS Code / Cursor) or a JetBrains IDE — click "Send Request" above any
request. Event/market IDs are chained automatically, so no copy-pasting IDs.

```bash
curl -H "X-Casino-Group: acme" http://localhost:3001/api/v1/sports
curl -H "X-Casino-Group: betzone" "http://localhost:3001/api/v1/fixtures?pageSize=5"
```

MVP decisions: [docs/DECISIONS.md](docs/DECISIONS.md). Full design: [docs/DESIGN.md](docs/DESIGN.md).

If port `3001` is in use, set `PORT` in `.env` to a free port before `npm run start:dev`.

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
