BEGIN;

CREATE TABLE "lab_currencies" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "name" TEXT NOT NULL,
    "icon" BYTEA NOT NULL,
    "icon_content_type" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_currencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lab_currencies_name_key" ON "lab_currencies"("name");

ALTER TABLE "lab_items"
    ADD COLUMN "currency_id" BIGINT,
    ADD COLUMN "currency_count" INTEGER,
    ADD CONSTRAINT "lab_items_currency_cost_check" CHECK (
        ("currency_id" IS NULL AND "currency_count" IS NULL)
        OR ("currency_id" IS NOT NULL AND "currency_count" IS NOT NULL AND "currency_count" > 0)
    ),
    ADD CONSTRAINT "lab_items_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "lab_currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "lab_items_currency_id_idx" ON "lab_items"("currency_id");

COMMIT;
