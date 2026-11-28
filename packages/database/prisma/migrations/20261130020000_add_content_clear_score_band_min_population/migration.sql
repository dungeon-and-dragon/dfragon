BEGIN;

ALTER TABLE "content_clear_settings" ADD COLUMN "score_band_min_population" INTEGER NOT NULL DEFAULT 0;

COMMIT;
