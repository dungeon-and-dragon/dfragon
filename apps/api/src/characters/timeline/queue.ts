import type { TimelineCharacter } from '@dfragon/database'

const TIMELINE_SYNC_CONCURRENCY = 2

export type RequestTimelineSync = (character: TimelineCharacter) => void

function characterKey({ serverId, characterId }: TimelineCharacter): string {
  return `${serverId}/${characterId}`
}

type QueuedSync = {
  character: TimelineCharacter
  finished: Promise<void>
  finish: () => void
}

function queuedSync(character: TimelineCharacter): QueuedSync {
  let finish!: () => void
  const finished = new Promise<void>((resolve) => {
    finish = resolve
  })

  return { character, finished, finish }
}

export interface TimelineSyncQueue {
  request: RequestTimelineSync
  // request와 같이 넣고, 그 캐릭터의 동기화가 성공하든 실패하든 끝나면 풀린다.
  // 닫을 때 대기열에 있던 요청과 닫은 뒤 새로 온 요청은 바로 풀리고, 진행 중인 동기화는 끝을 기다린다.
  requestAndWait(character: TimelineCharacter): Promise<void>
  // 진행 중인 동기화는 그대로 두고 대기열을 버리며, 이후 요청은 무시한다.
  close(): void
}

export function createTimelineSyncQueue(
  sync: (character: TimelineCharacter) => Promise<void>,
  reportFailure: () => void
): TimelineSyncQueue {
  // Map은 넣은 순서를 지키므로 먼저 온 캐릭터부터 꺼낸다.
  const waiting = new Map<string, QueuedSync>()
  const running = new Map<string, QueuedSync>()
  let closed = false

  const startWaiting = (): void => {
    for (const [key, queued] of waiting) {
      if (running.size >= TIMELINE_SYNC_CONCURRENCY) {
        return
      }
      waiting.delete(key)
      running.set(key, queued)
      // 동기화는 실패를 직접 기록하므로 여기 오는 것은 그 기록마저 실패한 경우이고, 백필은 실패를 그대로 던진다.
      sync(queued.character)
        .catch(reportFailure)
        .finally(() => {
          running.delete(key)
          queued.finish()
          startWaiting()
        })
    }
  }

  const enqueue = (character: TimelineCharacter): QueuedSync | undefined => {
    const key = characterKey(character)
    const existing = waiting.get(key) ?? running.get(key)
    if (existing !== undefined || closed) {
      return existing
    }
    const queued = queuedSync(character)
    waiting.set(key, queued)
    startWaiting()

    return queued
  }

  return {
    request(character) {
      enqueue(character)
    },
    async requestAndWait(character) {
      await enqueue(character)?.finished
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
