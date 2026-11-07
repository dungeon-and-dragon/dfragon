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

export interface JobQueue<Key, Job extends Key = Key> {
  request(job: Job): void
  // request와 같이 넣고, 그 일이 성공하든 실패하든 끝나면 풀린다.
  // 닫을 때 대기열에 있던 요청과 닫은 뒤 새로 온 요청은 바로 풀리고, 진행 중인 일은 끝을 기다린다.
  requestAndWait(job: Job): Promise<void>
  has(key: Key): boolean
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
    close() {
      closed = true
      for (const queued of waiting.values()) {
        queued.finish()
      }
      waiting.clear()
    }
  }
}

export function createTimelineSyncQueue(
  sync: (character: TimelineCharacter) => Promise<void>,
  reportFailure: () => void
): TimelineSyncQueue {
  return createJobQueue(characterKey, sync, reportFailure, Number.POSITIVE_INFINITY)
}
