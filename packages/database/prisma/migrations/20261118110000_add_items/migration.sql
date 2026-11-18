BEGIN;

-- 타임라인 획득 아이템의 레벨과 종류를 itemId마다 한 번 Neople 아이템 상세로 받아 둔다.
-- Neople이 행을 주지 않은 itemId도 레벨과 종류를 NULL로 남겨 다시 묻지 않는다.
CREATE TABLE "items" (
    "item_id" TEXT NOT NULL,
    "available_level" INTEGER,
    "item_type" TEXT,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("item_id")
);

COMMIT;
