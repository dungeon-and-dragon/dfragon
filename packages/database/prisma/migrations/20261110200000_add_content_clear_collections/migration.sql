BEGIN;

-- CreateTable
CREATE TABLE "content_clear_collections" (
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "done" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "content_clear_collections_pkey" PRIMARY KEY ("started_at")
);

COMMIT;
