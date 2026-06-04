-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WalletOutboxStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL,
    "casinoGroupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "stake" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "combinedOdds" DECIMAL(12,3) NOT NULL,
    "potentialPayout" DECIMAL(14,2) NOT NULL,
    "walletReservationId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_legs" (
    "id" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "selectionName" TEXT NOT NULL,
    "priceAtPlacement" DECIMAL(10,3) NOT NULL,
    "legOrder" INTEGER NOT NULL,

    CONSTRAINT "bet_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_outbox" (
    "id" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WalletOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bets_casinoGroupId_userId_createdAt_idx" ON "bets"("casinoGroupId", "userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "bets_status_idx" ON "bets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bets_casinoGroupId_userId_idempotencyKey_key" ON "bets"("casinoGroupId", "userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "bet_legs_betId_idx" ON "bet_legs"("betId");

-- CreateIndex
CREATE INDEX "bet_legs_selectionId_idx" ON "bet_legs"("selectionId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_outbox_betId_key" ON "wallet_outbox"("betId");

-- CreateIndex
CREATE INDEX "wallet_outbox_status_nextRetryAt_idx" ON "wallet_outbox"("status", "nextRetryAt");

-- AddForeignKey
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_betId_fkey" FOREIGN KEY ("betId") REFERENCES "bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "selections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
