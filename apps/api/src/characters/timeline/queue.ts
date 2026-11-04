import type { TimelineCharacter } from '@dfragon/database'

const TIMELINE_SYNC_CONCURRENCY = 2

export type RequestTimelineSync = (character: TimelineCharacter) => void

function characterKey({ serverId, characterId }: TimelineCharacter): string {
  return `${serverId}/${characterId}`
}

export interface TimelineSyncQueue {
  request: RequestTimelineSync
  // 진행 중인 동기화는 그대로 두고 대기열을 버리며, 이후 요청은 무시한다.
  close(): void
}

export function createTimelineSyncQueue(
  sync: (character: TimelineCharacter) => Promise<void>,
  reportFailure: () => void
): TimelineSyncQueue {
  // Map은 넣은 순서를 지키므로 먼저 온 캐릭터부터 꺼낸다.
  const waiting = new Map<string, TimelineCharacter>()
  const running = new Set<string>()
  let closed = false

  const startWaiting = (): void => {
    for (const [key, character] of waiting) {
      if (running.size >= TIMELINE_SYNC_CONCURRENCY) {
        return
      }
      waiting.delete(key)
      running.add(key)
      // 동기화는 실패를 직접 기록하므로, 여기 오는 것은 그 기록마저 실패한 경우다.
      sync(character)
        .catch(reportFailure)
        .finally(() => {
          running.delete(key)
          startWaiting()
        })
    }
  }

  return {
    request(character) {
      const key = characterKey(character)
      if (closed || waiting.has(key) || running.has(key)) {
        return
      }
      waiting.set(key, character)
      startWaiting()
    },
    close() {
      closed = true
      waiting.clear()
    }
  }
}
