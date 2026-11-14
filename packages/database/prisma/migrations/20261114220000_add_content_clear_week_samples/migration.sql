BEGIN;

-- 마감한 주의 클리어 집계 재료를 worker가 한 번 계산해 두고 API가 읽는다. 한 주를 요청마다 계산하면 컨텐츠 하나에
-- 수십 초가 걸려 지난 주를 넘겨 볼 때 계산이 줄에 쌓였다(2026-11-14).
CREATE TABLE "content_clear_week_samples" (
    "content_id" TEXT NOT NULL,
    "week_start" TIMESTAMPTZ(3) NOT NULL,
    "samples" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_clear_week_samples_pkey" PRIMARY KEY ("content_id", "week_start")
);

CREATE TABLE "content_clear_overview_samples" (
    "week_start" TIMESTAMPTZ(3) NOT NULL,
    "samples" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_clear_overview_samples_pkey" PRIMARY KEY ("week_start")
);

COMMIT;
