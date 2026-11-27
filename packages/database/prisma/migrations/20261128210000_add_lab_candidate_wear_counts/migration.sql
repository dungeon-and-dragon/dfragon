BEGIN;

CREATE TABLE "lab_candidate_wear_counts" (
    "item_name" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "computed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lab_candidate_wear_counts_pkey" PRIMARY KEY ("item_name", "slot_id"),
    CONSTRAINT "lab_candidate_wear_counts_slot_id_check" CHECK ("slot_id" IN ('TITLE', 'AURORA', 'CREATURE')),
    CONSTRAINT "lab_candidate_wear_counts_count_check" CHECK ("count" > 0)
);

COMMIT;
