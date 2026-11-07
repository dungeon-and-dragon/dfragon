BEGIN;

-- CreateTable
CREATE TABLE "character_skill_styles" (
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "job_grow_id" TEXT NOT NULL,
    "skills" JSONB NOT NULL,
    "evolutions" JSONB NOT NULL,
    "enhancements" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "character_skill_styles_pkey" PRIMARY KEY ("server_id","character_id")
);

-- AddForeignKey
ALTER TABLE "character_skill_styles" ADD CONSTRAINT "character_skill_styles_server_id_character_id_fkey" FOREIGN KEY ("server_id", "character_id") REFERENCES "characters"("server_id", "character_id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
