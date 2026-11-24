import type { TimelineCharacter } from '@dfragon/database'

export type RequestTimelineSync = (character: TimelineCharacter) => void

function characterKey({ serverId, characterId }: TimelineCharacter): string {
  return `${serverId}/${characterId}`
}

type QueuedJob<Job> = {
  job: Job
  finished: Promise<void>
  finish: () => void
}

function queuedJob<Job>(job: Job): QueuedJob<Job> {
  let finish!: () => void
  const finished = new Promise<void>((resolve) => {
    finish = resolve
  })

  return { job, finished, finish }
}

export type JobQueueCounts = {
  readonly waiting: number
  readonly running: number
}

export interface JobQueue<Key, Job extends Key = Key> {
  request(job: Job): void
  // request와 같이 넣고, 그 일이 성공하든 실패하든 끝나면 풀린다.
  // 닫을 때 대기열에 있던 요청과 닫은 뒤 새로 온 요청은 바로 풀리고, 진행 중인 일은 끝을 기다린다.
  requestAndWait(job: Job): Promise<void>
  has(key: Key): boolean
  counts(): JobQueueCounts
  // 진행 중인 일은 그대로 두고 대기열을 버리며, 이후 요청은 무시한다.
  close(): void
}

export type TimelineSyncQueue = JobQueue<TimelineCharacter>

export function createJobQueue<Key, Job extends Key>(
  keyOf: (key: Key) => string,
  run: (job: Job) => Promise<void>,
  reportFailure: () => void,
  concurrency: number
): JobQueue<Key, Job> {
  // Map은 넣은 순서를 지키므로 먼저 온 일부터 꺼낸다.
  const waiting = new Map<string, QueuedJob<Job>>()
  const running = new Map<string, QueuedJob<Job>>()
  let closed = false

  const startWaiting = (): void => {
    for (const [key, queued] of waiting) {
      if (running.size >= concurrency) {
        return
      }
      waiting.delete(key)
      running.set(key, queued)
      // 동기화는 실패를 직접 기록하므로 여기 오는 것은 그 기록마저 실패한 경우이고, 백필은 실패를 그대로 던진다.
      run(queued.job)
        .catch(reportFailure)
        .finally(() => {
          running.delete(key)
          queued.finish()
          startWaiting()
        })
    }
  }

  const enqueue = (job: Job): QueuedJob<Job> | undefined => {
    const key = keyOf(job)
    const existing = waiting.get(key) ?? running.get(key)
    if (existing !== undefined || closed) {
      return existing
    }
    const queued = queuedJob(job)
    waiting.set(key, queued)
    startWaiting()

    return queued
  }

  return {
    request(job) {
      enqueue(job)
    },
    async requestAndWait(job) {
      await enqueue(job)?.finished
    },
    has(key) {
      const queueKey = keyOf(key)

      return waiting.has(queueKey) || running.has(queueKey)
    },
    counts() {
      return { waiting: waiting.size, running: running.size }
    },
    close() {
      closed = true
      for (const queued of waiting.values()) {
        queued.finish()
      }
      waiting.clear()
    }
  }
}

// 상한이 없던 2026-11-24 운영 부하 테스트에서 동기화와 백필 수백 개가 함께 돌아 메인 연결 풀 10개가 찼고, 동기화의 45%가 실패하며
// 같은 풀을 쓰는 랭킹, 검색도 느려졌다. 옛 시즌 받기 2개와 합쳐 8개라 읽기 경로가 쓸 연결이 남는다(ADR 0087).
const TIMELINE_SYNC_CONCURRENCY = 4
const ENHANCEMENT_BACKFILL_CONCURRENCY = 2

export function createTimelineSyncQueue(
  sync: (character: TimelineCharacter) => Promise<void>,
  reportFailure: () => void
): TimelineSyncQueue {
  return createJobQueue(characterKey, sync, reportFailure, TIMELINE_SYNC_CONCURRENCY)
}

export function createEnhancementBackfillQueue(
  backfill: (character: TimelineCharacter) => Promise<void>,
  reportFailure: () => void
): TimelineSyncQueue {
  return createJobQueue(characterKey, backfill, reportFailure, ENHANCEMENT_BACKFILL_CONCURRENCY)
}
