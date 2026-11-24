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
  // request와 같이 넣되 기다리는 다른 일보다 먼저 시작하고, 그 일이 성공하든 실패하든 끝나면 풀린다.
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
  // 누가 끝을 기다리는 일은 awaited에 두어, 화면이 요청만 해 둔 일이 쌓여 있어도 그 뒤에서 기다리지 않게 한다.
  const awaited = new Map<string, QueuedJob<Job>>()
  const waiting = new Map<string, QueuedJob<Job>>()
  const running = new Map<string, QueuedJob<Job>>()
  let closed = false

  const startFrom = (lane: Map<string, QueuedJob<Job>>): void => {
    for (const [key, queued] of lane) {
      if (running.size >= concurrency) {
        return
      }

      lane.delete(key)
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

  const startWaiting = (): void => {
    for (const lane of [awaited, waiting]) {
      startFrom(lane)
    }
  }

  const enqueue = (job: Job, lane: Map<string, QueuedJob<Job>>): QueuedJob<Job> | undefined => {
    const key = keyOf(job)
    const existing = awaited.get(key) ?? waiting.get(key) ?? running.get(key)

    if (closed) {
      return existing
    }

    if (existing !== undefined) {
      if (lane === awaited && waiting.delete(key)) {
        awaited.set(key, existing)
      }

      return existing
    }

    const queued = queuedJob(job)
    lane.set(key, queued)
    startWaiting()

    return queued
  }

  return {
    request(job) {
      enqueue(job, waiting)
    },
    async requestAndWait(job) {
      await enqueue(job, awaited)?.finished
    },
    has(key) {
      const queueKey = keyOf(key)

      return awaited.has(queueKey) || waiting.has(queueKey) || running.has(queueKey)
    },
    counts() {
      return { waiting: awaited.size + waiting.size, running: running.size }
    },
    close() {
      closed = true

      for (const lane of [awaited, waiting]) {
        for (const queued of lane.values()) {
          queued.finish()
        }

        lane.clear()
      }
    }
  }
}

// 상한이 없으면 동기화와 백필 수백 개가 함께 돌아 연결 풀이 차고 동기화가 실패했다(2026-11-24 운영 부하 테스트, ADR 0087).
// 10과 4로 올리면 동기화가 API의 event loop를 차지해 동시 400명에서 p95가 0.6초에서 1.9초로 늘었고, 처리량은 초당 2.3명에서
// 3.1명으로만 올랐다(ADR 0090).
export const TIMELINE_SYNC_CONCURRENCY = 4
export const ENHANCEMENT_BACKFILL_CONCURRENCY = 2

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
