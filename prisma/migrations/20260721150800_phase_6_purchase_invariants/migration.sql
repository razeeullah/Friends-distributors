ALTER TABLE "suppliers"
  ADD CONSTRAINT "suppliers_opening_balance_nonnegative"
  CHECK ("openingBalance" >= 0);

ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_quantities_valid"
  CHECK (
    "quantity" > 0 AND
    "receivedQuantity" >= 0 AND
    "receivedQuantity" <= "quantity"
  );

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "purchase_movements_require_line_reference"
  CHECK (
    "movementType" <> 'PURCHASE' OR
    ("referenceType" = 'PURCHASE' AND "referenceLineId" IS NOT NULL)
  );
