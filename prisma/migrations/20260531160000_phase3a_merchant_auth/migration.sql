-- AlterTable
ALTER TABLE "casino_groups" ADD COLUMN "merchantId" TEXT;
ALTER TABLE "casino_groups" ADD COLUMN "sportsSecret" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "casino_groups_merchantId_key" ON "casino_groups"("merchantId");
