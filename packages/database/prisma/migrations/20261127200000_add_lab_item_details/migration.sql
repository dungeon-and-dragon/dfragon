BEGIN;

CREATE TABLE "lab_item_details" (
    "item_name" TEXT NOT NULL,
    "icon" BYTEA,
    "icon_content_type" TEXT,
    "description" TEXT,
    "item_rarity" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_item_details_pkey" PRIMARY KEY ("item_name"),
    CONSTRAINT "lab_item_details_icon_check" CHECK (("icon" IS NULL) = ("icon_content_type" IS NULL))
);

COMMIT;
