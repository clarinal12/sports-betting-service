-- CreateEnum
CREATE TYPE "StaffUserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('OPERATOR_ADMIN', 'TRADER', 'RISK_MANAGER', 'CUSTOMER_SUPPORT', 'SETTLEMENT', 'FINANCE', 'COMPLIANCE');

-- CreateTable
CREATE TABLE "staff_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "casinoGroupId" TEXT,
    "roles" "StaffRole"[],
    "status" "StaffUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_policies" (
    "id" TEXT NOT NULL,
    "casinoGroupId" TEXT NOT NULL,
    "rules" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offering_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_limits" (
    "id" TEXT NOT NULL,
    "casinoGroupId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeRef" TEXT,
    "minStake" DECIMAL(12,2),
    "maxStake" DECIMAL(12,2),
    "maxPayout" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE INDEX "staff_users_casinoGroupId_idx" ON "staff_users"("casinoGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_sessions_refreshTokenHash_key" ON "staff_sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "staff_sessions_staffUserId_idx" ON "staff_sessions"("staffUserId");

-- CreateIndex
CREATE UNIQUE INDEX "offering_policies_casinoGroupId_key" ON "offering_policies"("casinoGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_limits_casinoGroupId_scope_scopeRef_key" ON "risk_limits"("casinoGroupId", "scope", "scopeRef");

-- AddForeignKey
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_casinoGroupId_fkey" FOREIGN KEY ("casinoGroupId") REFERENCES "casino_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_policies" ADD CONSTRAINT "offering_policies_casinoGroupId_fkey" FOREIGN KEY ("casinoGroupId") REFERENCES "casino_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_limits" ADD CONSTRAINT "risk_limits_casinoGroupId_fkey" FOREIGN KEY ("casinoGroupId") REFERENCES "casino_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
