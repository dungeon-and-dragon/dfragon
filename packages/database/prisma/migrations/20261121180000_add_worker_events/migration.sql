-- worker 로그는 컨테이너 stdout에만 있어 잡이 도는 동안 Neople 실패 원인을 DB 조회로 볼 수 없었다.
-- worker가 남기는 이벤트를 한 번에 한 행으로 저장하고, 오래된 행은 실행 이력 정리 잡이 지운다.
BEGIN;

CREATE TABLE "worker_events" (
    "id" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "code" TEXT NOT NULL,
    "details" JSONB NOT NULL,

    CONSTRAINT "worker_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "worker_events_occurred_at_idx" ON "worker_events"("occurred_at");

CREATE INDEX "worker_events_code_occurred_at_idx" ON "worker_events"("code", "occurred_at" DESC);

COMMIT;
