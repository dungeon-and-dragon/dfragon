BEGIN;

ALTER TABLE "lab_item_details"
    ADD COLUMN "item_type_detail" TEXT,
    ADD COLUMN "available_level" INTEGER,
    ADD COLUMN "fame" INTEGER,
    ADD COLUMN "card" JSONB,
    ADD CONSTRAINT "lab_item_details_available_level_check" CHECK ("available_level" > 0),
    ADD CONSTRAINT "lab_item_details_fame_check" CHECK ("fame" > 0),
    ADD CONSTRAINT "lab_item_details_card_check" CHECK (jsonb_typeof("card") = 'object');

COMMIT;
