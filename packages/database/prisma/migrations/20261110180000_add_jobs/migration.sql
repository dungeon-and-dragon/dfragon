BEGIN;

-- CreateTable
CREATE TABLE "jobs" (
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "schedule" TEXT,
    "args_schema" JSONB NOT NULL,
    "delay_minutes" INTEGER NOT NULL,
    "paused_at" TIMESTAMPTZ(3),
    "next_run_at" TIMESTAMPTZ(3),
    "worker_seen_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" SERIAL NOT NULL,
    "job_name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "progress_done" INTEGER,
    "progress_total" INTEGER,
    "summary" JSONB,
    "error" JSONB,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "job_runs_trigger_check" CHECK ("trigger" IN ('schedule', 'catchup', 'manual')),
    CONSTRAINT "job_runs_status_check" CHECK ("status" IN ('requested', 'running', 'succeeded', 'failed', 'interrupted'))
);

-- CreateIndex
CREATE INDEX "job_runs_job_name_requested_at_idx" ON "job_runs"("job_name", "requested_at" DESC);

-- 같은 job은 요청이나 실행 중인 행을 하나만 둔다. Prisma schema는 partial index를 나타내지 못해 migration에만 둔다.
CREATE UNIQUE INDEX "job_runs_active_key" ON "job_runs"("job_name") WHERE "status" IN ('requested', 'running');

COMMIT;
