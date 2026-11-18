BEGIN;

ALTER TABLE "characters" ADD COLUMN     "equipment_set_id" TEXT,
ADD COLUMN     "equipment_set_name" TEXT,
ADD COLUMN     "oath_set_id" INTEGER,
ADD COLUMN     "oath_set_name" TEXT,
ADD COLUMN     "oath_set_option" TEXT,
ADD COLUMN     "sets_fetched_at" TIMESTAMPTZ(3);

-- 세트로 거른 명성 랭킹이 명성 순서로 index만 따라 읽게 한다. 세트가 없는 행은 거르는 대상이 아니라 담지 않는다.
CREATE INDEX "characters_equipment_set_id_fame_idx" ON "characters"("equipment_set_id", "fame" DESC) WHERE "equipment_set_id" IS NOT NULL;

CREATE INDEX "characters_oath_set_id_fame_idx" ON "characters"("oath_set_id", "fame" DESC) WHERE "oath_set_id" IS NOT NULL;

COMMIT;
