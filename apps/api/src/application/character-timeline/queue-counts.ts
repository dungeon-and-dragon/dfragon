import type { TimelineQueueCount } from '@dfragon/database'
import type { TimelineQueueCountRepository } from './repository.js'

const WRITE_INTERVAL_MS = 5000

export interface QueueCountsWriter {
  // 주기 쓰기를 멈추고 진행 중인 쓰기가 끝나기를 기다린다.
  stop(): Promise<void>
}

/**
 * 시작할 때 모든 queue의 수를 쓰고, 그 뒤 주기마다 마지막으로 쓴 값과 달라진 queue만 쓴다.
 * 쓰기가 실패한 queue는 쓴 값으로 남기지 않아 다음 주기에 다시 쓴다.
 */
export function startQueueCountsWriter(
  readCounts: () => readonly TimelineQueueCount[],
  write: TimelineQueueCountRepository['writeCounts'],
  reportFailure: () => void,
  intervalMs = WRITE_INTERVAL_MS
): QueueCountsWriter {
  const written = new Map<string, TimelineQueueCount>()
  let writing: Promise<void> | undefined

  const writeChanged = async () => {
    const changed = readCounts().filter((count) => {
      const last = written.get(count.name)

      return last?.waiting !== count.waiting || last.running !== count.running
    })

    if (changed.length === 0) {
      return
    }

    try {
      await write(changed)

      for (const count of changed) {
        written.set(count.name, count)
      }
    } catch {
      reportFailure()
    }
  }

  const tick = () => {
    // 앞 쓰기가 끝나지 않았으면 이번 주기를 건너뛰어, 늦게 끝난 쓰기가 더 새 값을 덮지 않게 한다.
    if (writing !== undefined) {
      return
    }

    writing = writeChanged().finally(() => {
      writing = undefined
    })
  }

  tick()
  const timer = setInterval(tick, intervalMs)

  return {
    async stop() {
      clearInterval(timer)
      await writing
    }
  }
}
