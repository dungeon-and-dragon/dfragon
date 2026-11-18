BEGIN;

CREATE TABLE "item_adoption" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "job_id" TEXT NOT NULL,
    "job_grow_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "slot_id" TEXT,
    "item_id" TEXT,
    "item_name" TEXT,
    "count" INTEGER NOT NULL,
    "computed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "item_adoption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "item_adoption_job_id_job_grow_id_role_idx" ON "item_adoption"("job_id", "job_grow_id", "role");

COMMIT;
