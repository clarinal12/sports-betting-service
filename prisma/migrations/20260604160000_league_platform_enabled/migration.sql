-- AlterTable
ALTER TABLE "casino_group_leagues" ADD COLUMN "platformEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "casino_group_leagues"
SET "platformEnabled" = NOT "platformLocked";

ALTER TABLE "casino_group_leagues" DROP COLUMN "platformLocked";
