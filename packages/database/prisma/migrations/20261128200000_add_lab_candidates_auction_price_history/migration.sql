BEGIN;

CREATE TABLE "lab_candidates" (
    "item_name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "categories" TEXT[] NOT NULL,
    "roles" TEXT[] NOT NULL,
    "item_rarity" TEXT,
    "fame" INTEGER,
    "available_level" INTEGER,
    "item_type_detail" TEXT,
    "options" JSONB NOT NULL,
    "buff_lines" JSONB NOT NULL,
    "card" JSONB,
    "description" TEXT,
    "icon" BYTEA,
    "icon_content_type" TEXT,
    "icon_updated_at" TIMESTAMPTZ(3),
    "version_id" TEXT NOT NULL,
    "source_item_id" TEXT NOT NULL,
    "imported_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lab_candidates_pkey" PRIMARY KEY ("item_name"),
    CONSTRAINT "lab_candidates_kind_check" CHECK ("kind" IN ('TITLE', 'CREATURE', 'AURA', 'ENCHANT')),
    CONSTRAINT "lab_candidates_categories_roles_check" CHECK (
        "kind" = 'ENCHANT' OR ("categories" = ARRAY["kind"] AND "roles" = ARRAY['all']::TEXT[])
    ),
    CONSTRAINT "lab_candidates_icon_check" CHECK (("icon" IS NULL) = ("icon_content_type" IS NULL)),
    CONSTRAINT "lab_candidates_options_check" CHECK (jsonb_typeof("options") = 'array'),
    CONSTRAINT "lab_candidates_buff_lines_check" CHECK (jsonb_typeof("buff_lines") = 'array'),
    CONSTRAINT "lab_candidates_card_check" CHECK (jsonb_typeof("card") = 'object')
);

CREATE INDEX "lab_candidates_kind_fame_idx" ON "lab_candidates"("kind", "fame" DESC);
CREATE INDEX "lab_candidates_version_id_idx" ON "lab_candidates"("version_id");

CREATE TABLE "auction_price_history" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "item_name" TEXT NOT NULL,
    "item_id" TEXT,
    "unit_price" BIGINT,
    "checked_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auction_price_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auction_price_history_item_name_checked_at_idx" ON "auction_price_history"("item_name", "checked_at" DESC);

COMMIT;
