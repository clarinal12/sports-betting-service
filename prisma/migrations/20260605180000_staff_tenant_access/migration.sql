-- Platform admin tenant scoping (SUPER_ADMIN grants)
CREATE TABLE "staff_casino_group_access" (
    "staffUserId" TEXT NOT NULL,
    "casinoGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_casino_group_access_pkey" PRIMARY KEY ("staffUserId","casinoGroupId")
);

ALTER TABLE "staff_casino_group_access" ADD CONSTRAINT "staff_casino_group_access_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_casino_group_access" ADD CONSTRAINT "staff_casino_group_access_casinoGroupId_fkey" FOREIGN KEY ("casinoGroupId") REFERENCES "casino_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
