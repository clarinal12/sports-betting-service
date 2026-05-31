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

`db:seed` loads catalog + fixtures (via the mock provider) and two demo casino
groups: `acme` (all leagues) and `betzone` (soccer only). To refresh just the
schedule later, run `npm run ingest:fixtures`.

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

## Player API (Phase 1)

All player endpoints are tenant-scoped and require the `X-Casino-Group` header
(value = casino group slug, e.g. `acme`). Missing header → `400`, unknown or
inactive group → `403`.

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
