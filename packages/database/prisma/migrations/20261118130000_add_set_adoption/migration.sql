BEGIN;

CREATE TABLE "set_adoption" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "job_id" TEXT NOT NULL,
    "job_grow_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "equipment_set_id" TEXT,
    "equipment_set_name" TEXT,
    "oath_set_id" INTEGER,
    "oath_set_name" TEXT,
    "oath_set_option" TEXT,
    "count" INTEGER NOT NULL,
    "computed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "set_adoption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "set_adoption_job_id_job_grow_id_role_idx" ON "set_adoption"("job_id", "job_grow_id", "role");

COMMIT;
