BEGIN;

CREATE TABLE "lab_items" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "category" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lab_items_category_role_tier_item_name_key" ON "lab_items"("category", "role", "tier", "item_name");

CREATE TABLE "auction_prices" (
    "item_name" TEXT NOT NULL,
    "item_id" TEXT,
    "item_rarity" TEXT,
    "unit_price" BIGINT,
    "checked_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auction_prices_pkey" PRIMARY KEY ("item_name")
);

COMMIT;
