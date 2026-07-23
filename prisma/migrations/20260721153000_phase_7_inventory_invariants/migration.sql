ALTER TABLE "stock_adjustment_items"
  ADD CONSTRAINT "stock_adjustment_items_snapshot_quantities_nonnegative"
  CHECK ("systemQuantity" >= 0 AND "countedQuantity" >= 0);

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "adjustment_movements_require_line_reference"
  CHECK (
    "movementType" NOT IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT') OR
    ("referenceType" = 'STOCK_ADJUSTMENT' AND "referenceLineId" IS NOT NULL)
  );
