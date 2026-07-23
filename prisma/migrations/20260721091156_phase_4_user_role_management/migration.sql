-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'USER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_PASSWORD_RESET';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_PERMISSIONS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'SESSION_REVOKED';

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'INVITED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "defaultLocationId" UUID,
ADD COLUMN     "phone" VARCHAR(32);

-- CreateIndex
CREATE INDEX "users_defaultLocationId_idx" ON "users"("defaultLocationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
