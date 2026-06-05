-- AlterTable: freeze market/event context on each leg at placement for settlement.
ALTER TABLE "bet_legs" ADD COLUMN "marketType" "MarketType",
ADD COLUMN "marketLine" DECIMAL(6,2),
ADD COLUMN "homeTeamName" TEXT,
ADD COLUMN "awayTeamName" TEXT,
ADD COLUMN "eventProviderRef" TEXT;
