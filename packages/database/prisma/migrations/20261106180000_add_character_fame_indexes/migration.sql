BEGIN;

-- CreateIndex
CREATE INDEX "characters_fame_idx" ON "characters"("fame" DESC);

-- CreateIndex
CREATE INDEX "characters_job_id_fame_idx" ON "characters"("job_id", "fame" DESC);

-- CreateIndex
CREATE INDEX "characters_job_id_job_grow_id_fame_idx" ON "characters"("job_id", "job_grow_id", "fame" DESC);

COMMIT;
