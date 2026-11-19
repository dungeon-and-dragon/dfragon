BEGIN;

ALTER TABLE "jobs" ADD COLUMN "neople_api_group" TEXT;
ALTER TABLE "jobs" ADD COLUMN "neople_endpoints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

COMMIT;
