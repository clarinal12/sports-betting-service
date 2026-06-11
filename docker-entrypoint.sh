#!/bin/sh
set -e

echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "Seeding database..."
  npm run db:seed
fi

echo "Starting API..."
exec node dist/main
