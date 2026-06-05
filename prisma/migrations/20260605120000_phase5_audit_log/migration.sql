-- CreateTable
CREATE TABLE "audit_log_entries" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "casinoGroupId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_entries_casinoGroupId_createdAt_idx" ON "audit_log_entries"("casinoGroupId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_log_entries_entityType_entityId_idx" ON "audit_log_entries"("entityType", "entityId");
