BEGIN;

CREATE TABLE "clear_record_cursors" (
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "fetched_until" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clear_record_cursors_pkey" PRIMARY KEY ("server_id","character_id")
);

COMMIT;
