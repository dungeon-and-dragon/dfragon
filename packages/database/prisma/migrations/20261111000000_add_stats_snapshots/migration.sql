BEGIN;

-- CreateTable
CREATE TABLE "character_stats" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "computed_at" TIMESTAMPTZ(3) NOT NULL,
    "total" INTEGER NOT NULL,
    "servers" JSONB NOT NULL,
    "jobs" JSONB NOT NULL,
    "fame_distribution" JSONB NOT NULL,

    CONSTRAINT "character_stats_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "character_stats_single_row_check" CHECK ("id" = 1)
);

-- CreateTable
CREATE TABLE "job_skill_adoption" (
    "job_id" TEXT NOT NULL,
    "job_grow_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "computed_at" TIMESTAMPTZ(3) NOT NULL,
    "min_fame" INTEGER,
    "sample_size" INTEGER NOT NULL,
    "skills" JSONB NOT NULL,
    "evolutions" JSONB NOT NULL,
    "enhancements" JSONB NOT NULL,

    CONSTRAINT "job_skill_adoption_pkey" PRIMARY KEY ("job_id","job_grow_id","role"),
    CONSTRAINT "job_skill_adoption_role_check" CHECK ("role" IN ('all', 'dealer', 'buffer'))
);

COMMIT;
