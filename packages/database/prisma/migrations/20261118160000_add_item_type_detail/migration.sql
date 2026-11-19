BEGIN;

ALTER TABLE "character_items" ADD COLUMN "item_type_detail" TEXT;

ALTER TABLE "item_adoption" ADD COLUMN "item_type_detail" TEXT;

COMMIT;
