BEGIN;

CREATE TABLE "content_clear_settings" (
    "content_id" TEXT NOT NULL,
    "collected" BOOLEAN NOT NULL DEFAULT true,
    "shown" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_clear_settings_pkey" PRIMARY KEY ("content_id")
);

COMMIT;
