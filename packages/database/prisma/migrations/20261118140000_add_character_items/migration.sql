BEGIN;

CREATE TABLE "character_items" (
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,

    CONSTRAINT "character_items_pkey" PRIMARY KEY ("server_id","character_id","slot_id")
);

CREATE INDEX "character_items_item_id_idx" ON "character_items"("item_id");

ALTER TABLE "character_items" ADD CONSTRAINT "character_items_server_id_character_id_fkey" FOREIGN KEY ("server_id", "character_id") REFERENCES "characters"("server_id", "character_id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
