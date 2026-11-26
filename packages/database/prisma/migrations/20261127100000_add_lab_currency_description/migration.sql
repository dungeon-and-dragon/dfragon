BEGIN;

ALTER TABLE "lab_currencies" ADD COLUMN "description" TEXT;

COMMIT;
