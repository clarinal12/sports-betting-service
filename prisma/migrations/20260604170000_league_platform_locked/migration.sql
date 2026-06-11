-- AlterTable
ALTER TABLE "casino_group_leagues" ADD COLUMN "platformLocked" BOOLEAN NOT NULL DEFAULT false;

UPDATE "casino_group_leagues"
SET "platformLocked" = NOT "platformEnabled";

ALTER TABLE "casino_group_leagues" DROP COLUMN "platformEnabled";
