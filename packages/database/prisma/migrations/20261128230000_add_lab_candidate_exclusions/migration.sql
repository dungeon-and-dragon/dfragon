BEGIN;

CREATE TABLE "lab_candidate_exclusions" (
    "item_name" TEXT NOT NULL,
    "excluded_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lab_candidate_exclusions_pkey" PRIMARY KEY ("item_name")
);

COMMIT;
