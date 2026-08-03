-- Product storefront URLs now use the immutable Product.id. Product slugs are
-- no longer editable or required by any application workflow.
DROP INDEX "Product_slug_key";
ALTER TABLE "Product" DROP COLUMN "slug";

-- Preserve localized purchase-time alternative text alongside the existing
-- purchase-time image URL. Existing order items remain valid with NULL values.
ALTER TABLE "OrderItem"
ADD COLUMN "imageAltArSnapshot" TEXT,
ADD COLUMN "imageAltEnSnapshot" TEXT;
