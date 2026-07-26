-- Separate lifecycle state from sellable availability.
ALTER TABLE "Product"
ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ProductVariant"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Legacy ledger rows cannot always be reconstructed safely. New application
-- writes populate both values; nullable columns preserve honest legacy data.
ALTER TABLE "InventoryAdjustment"
ADD COLUMN "previousStock" INTEGER,
ADD COLUMN "newStock" INTEGER;

ALTER TABLE "InventoryAdjustment"
ADD CONSTRAINT "InventoryAdjustment_stock_snapshot_check"
CHECK (
  ("previousStock" IS NULL AND "newStock" IS NULL)
  OR (
    "previousStock" >= 0
    AND "newStock" >= 0
    AND "newStock" = "previousStock" + "quantityDelta"
  )
);

DROP INDEX "ProductVariant_productId_isAvailable_displayOrder_idx";
CREATE INDEX "ProductVariant_productId_isActive_isAvailable_displayOrder_idx"
ON "ProductVariant"("productId", "isActive", "isAvailable", "displayOrder");

CREATE INDEX "Product_status_isAvailable_createdAt_idx"
ON "Product"("status", "isAvailable", "createdAt");
