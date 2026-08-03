-- Product-level promotions. The normal price remains in `price`; `salePrice`
-- is the canonical promotional price used while the optional date window is active.
ALTER TABLE "Product"
ADD COLUMN "isOnSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "salePrice" DECIMAL(12,2),
ADD COLUMN "saleStartsAt" TIMESTAMP(3),
ADD COLUMN "saleEndsAt" TIMESTAMP(3),
ADD COLUMN "saleUpdatedAt" TIMESTAMP(3);

CREATE INDEX "Product_isOnSale_status_isAvailable_saleStartsAt_saleEndsAt_idx"
ON "Product"("isOnSale", "status", "isAvailable", "saleStartsAt", "saleEndsAt");

ALTER TABLE "Product"
ADD CONSTRAINT "Product_salePrice_positive_and_below_price"
CHECK ("salePrice" IS NULL OR ("salePrice" > 0 AND "salePrice" < "price"));

ALTER TABLE "Product"
ADD CONSTRAINT "Product_sale_window_valid"
CHECK ("saleStartsAt" IS NULL OR "saleEndsAt" IS NULL OR "saleStartsAt" < "saleEndsAt");
