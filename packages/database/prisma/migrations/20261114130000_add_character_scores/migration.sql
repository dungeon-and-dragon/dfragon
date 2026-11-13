BEGIN;

-- CreateTable
CREATE TABLE "character_scores" (
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "calculated_at" TIMESTAMPTZ(3) NOT NULL,
    "engine_package" TEXT NOT NULL,
    "engine_rules_rev" TEXT NOT NULL,
    "engine_bundle_id" TEXT NOT NULL,

    CONSTRAINT "character_scores_pkey" PRIMARY KEY ("server_id","character_id")
);

-- AddForeignKey
ALTER TABLE "character_scores" ADD CONSTRAINT "character_scores_server_id_character_id_fkey" FOREIGN KEY ("server_id", "character_id") REFERENCES "characters"("server_id", "character_id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
