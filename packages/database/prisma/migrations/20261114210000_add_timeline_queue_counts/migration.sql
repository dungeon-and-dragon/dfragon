BEGIN;

-- API process 메모리에 있는 타임라인 queue의 대기, 처리 중 수를 운영 경로가 읽도록 API가 queue마다 한 행씩 쓴다.
CREATE TABLE "timeline_queue_counts" (
    "name" TEXT NOT NULL,
    "waiting" INTEGER NOT NULL,
    "running" INTEGER NOT NULL,

    CONSTRAINT "timeline_queue_counts_pkey" PRIMARY KEY ("name")
);

COMMIT;
