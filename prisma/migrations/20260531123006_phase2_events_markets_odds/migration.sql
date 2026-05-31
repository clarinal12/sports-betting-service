-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'LIVE', 'SUSPENDED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('MATCH_RESULT', 'HANDICAP', 'TOTAL', 'DOUBLE_CHANCE', 'BOTH_TEAMS_SCORE');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('OPEN', 'SUSPENDED', 'SETTLED', 'VOID');

-- CreateEnum
CREATE TYPE "SelectionStatus" AS ENUM ('OPEN', 'SUSPENDED', 'SETTLED', 'VOID');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "period" TEXT,
    "clock" TEXT,
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "type" "MarketType" NOT NULL,
    "status" "MarketStatus" NOT NULL DEFAULT 'OPEN',
    "line" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selections" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SelectionStatus" NOT NULL DEFAULT 'OPEN',
    "price" DECIMAL(10,3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_snapshots" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "price" DECIMAL(10,3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_fixtureId_key" ON "events"("fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "events_providerRef_key" ON "events"("providerRef");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "markets_providerRef_key" ON "markets"("providerRef");

-- CreateIndex
CREATE INDEX "markets_eventId_type_idx" ON "markets"("eventId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "selections_providerRef_key" ON "selections"("providerRef");

-- CreateIndex
CREATE INDEX "selections_marketId_idx" ON "selections"("marketId");

-- CreateIndex
CREATE INDEX "odds_snapshots_selectionId_capturedAt_idx" ON "odds_snapshots"("selectionId", "capturedAt");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selections" ADD CONSTRAINT "selections_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "selections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
