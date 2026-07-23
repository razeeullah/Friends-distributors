-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'AUTH_PASSWORD_CHANGED';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "currentLocationId" UUID,
ADD COLUMN     "rememberMe" BOOLEAN NOT NULL DEFAULT false;

-- Add and backfill usernames without exposing email addresses or risking collisions.
ALTER TABLE "users" ADD COLUMN "username" VARCHAR(64);
UPDATE "users" SET "username" = 'user_' || REPLACE("id"::text, '-', '') WHERE "username" IS NULL;
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE INDEX "sessions_currentLocationId_idx" ON "sessions"("currentLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_businessId_username_key" ON "users"("businessId", "username");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
