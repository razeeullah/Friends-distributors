ALTER TABLE "categories" ADD COLUMN "parentId" UUID, ADD COLUMN "imageUrl" VARCHAR(2048), ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "createdById" UUID, ADD COLUMN "updatedById" UUID;
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "categories_businessId_parentId_name_idx" ON "categories"("businessId","parentId","name");
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");
CREATE INDEX "categories_businessId_displayOrder_idx" ON "categories"("businessId","displayOrder");
