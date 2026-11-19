BEGIN;

-- 아이템의 세트, 부위, 등급을 함께 받아 둔다. 옛 버전 코드가 이 열 없이 쓸 수 있게 모두 nullable이다.
ALTER TABLE "items" ADD COLUMN "item_type_detail" TEXT;
ALTER TABLE "items" ADD COLUMN "item_rarity" TEXT;
ALTER TABLE "items" ADD COLUMN "set_item_id" TEXT;
ALTER TABLE "items" ADD COLUMN "set_item_name" TEXT;

COMMIT;
