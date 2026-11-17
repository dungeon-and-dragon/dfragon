BEGIN;

-- CreateTable
CREATE TABLE "character_basic_history" (
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "character_name" TEXT NOT NULL,
    "adventure_name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "job_id" TEXT NOT NULL,
    "job_grow_id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "job_grow_name" TEXT NOT NULL,
    "fame" INTEGER,
    "guild_id" TEXT,
    "guild_name" TEXT,

    CONSTRAINT "character_basic_history_pkey" PRIMARY KEY ("server_id","character_id","observed_at")
);

-- CreateTable
CREATE TABLE "character_section_history" (
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "content_hash" UUID NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "character_section_history_pkey" PRIMARY KEY ("server_id","character_id","section","observed_at")
);

-- CreateTable
CREATE TABLE "character_score_history" (
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "engine_id" INTEGER NOT NULL,

    CONSTRAINT "character_score_history_pkey" PRIMARY KEY ("server_id","character_id","observed_at")
);

-- CreateTable
CREATE TABLE "score_engines" (
    "id" SERIAL NOT NULL,
    "package" TEXT NOT NULL,
    "rules_rev" TEXT NOT NULL,
    "bundle_id" TEXT NOT NULL,

    CONSTRAINT "score_engines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "score_engines_package_rules_rev_bundle_id_key" ON "score_engines"("package", "rules_rev", "bundle_id");

-- AddForeignKey
ALTER TABLE "character_basic_history" ADD CONSTRAINT "character_basic_history_server_id_character_id_fkey" FOREIGN KEY ("server_id", "character_id") REFERENCES "characters"("server_id", "character_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_section_history" ADD CONSTRAINT "character_section_history_server_id_character_id_fkey" FOREIGN KEY ("server_id", "character_id") REFERENCES "characters"("server_id", "character_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_score_history" ADD CONSTRAINT "character_score_history_server_id_character_id_fkey" FOREIGN KEY ("server_id", "character_id") REFERENCES "characters"("server_id", "character_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_score_history" ADD CONSTRAINT "character_score_history_engine_id_fkey" FOREIGN KEY ("engine_id") REFERENCES "score_engines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
