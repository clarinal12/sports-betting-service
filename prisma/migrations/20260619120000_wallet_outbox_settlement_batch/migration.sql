-- Allow multiple wallet outbox rows per bet (debit, settle, staff void).
ALTER TABLE "wallet_outbox" DROP CONSTRAINT IF EXISTS "wallet_outbox_betId_key";

ALTER TABLE "wallet_outbox" ADD COLUMN IF NOT EXISTS "casinoGroupId" TEXT;
ALTER TABLE "wallet_outbox" ADD COLUMN IF NOT EXISTS "transactionCode" TEXT;
ALTER TABLE "wallet_outbox" ADD COLUMN IF NOT EXISTS "batchId" TEXT;

UPDATE "wallet_outbox" wo
SET "casinoGroupId" = b."casinoGroupId"
FROM "bets" b
WHERE wo."betId" = b."id" AND wo."casinoGroupId" IS NULL;

UPDATE "wallet_outbox"
SET "transactionCode" = COALESCE("payload"->>'transactionCode', "id")
WHERE "transactionCode" IS NULL;

ALTER TABLE "wallet_outbox" ALTER COLUMN "casinoGroupId" SET NOT NULL;
ALTER TABLE "wallet_outbox" ALTER COLUMN "transactionCode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "wallet_outbox_transactionCode_key" ON "wallet_outbox"("transactionCode");
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_outbox_betId_type_key" ON "wallet_outbox"("betId", "type");
CREATE INDEX IF NOT EXISTS "wallet_outbox_status_type_casinoGroupId_nextRetryAt_idx"
  ON "wallet_outbox"("status", "type", "casinoGroupId", "nextRetryAt");
