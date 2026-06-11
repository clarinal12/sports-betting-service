FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Generate does not connect to the DB, but Prisma still parses DATABASE_URL.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN npm install --no-audit --no-fund \
  && ./node_modules/.bin/prisma generate --no-hints

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 5003
ENTRYPOINT ["./docker-entrypoint.sh"]

# Dev deployment image — keeps ts-node/prisma seed tooling.
FROM base AS dev-runner
RUN apk add --no-cache curl
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 5003
ENTRYPOINT ["./docker-entrypoint.sh"]
