ALTER TABLE "audit_logs" ADD COLUMN "summary" VARCHAR(500), ADD COLUMN "requestId" UUID;
CREATE INDEX "audit_logs_businessId_requestId_idx" ON "audit_logs"("businessId", "requestId");
