BEGIN;

-- CreateTable
CREATE TABLE "clear_record_backfills" (
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "done" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "clear_record_backfills_pkey" PRIMARY KEY ("started_at")
);

COMMIT;
