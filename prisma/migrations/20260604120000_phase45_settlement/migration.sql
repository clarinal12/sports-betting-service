-- CreateEnum
CREATE TYPE "BetLegOutcome" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

-- AlterEnum
ALTER TYPE "BetStatus" ADD VALUE 'WON';
ALTER TYPE "BetStatus" ADD VALUE 'LOST';
ALTER TYPE "BetStatus" ADD VALUE 'VOID';

-- AlterTable
ALTER TABLE "bets" ADD COLUMN "payoutAmount" DECIMAL(14,2),
ADD COLUMN "settledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "bet_legs" ADD COLUMN "outcome" "BetLegOutcome" NOT NULL DEFAULT 'PENDING';
