-- AlterTable
ALTER TABLE "bets" ADD COLUMN "username" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "bet_legs" ADD COLUMN "sportKey" TEXT;
ALTER TABLE "bet_legs" ADD COLUMN "sportName" TEXT;
ALTER TABLE "bet_legs" ADD COLUMN "leagueKey" TEXT;
ALTER TABLE "bet_legs" ADD COLUMN "leagueName" TEXT;
