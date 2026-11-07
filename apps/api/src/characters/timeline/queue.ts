import type { TimelineCharacter } from '@dfragon/database'

export type RequestTimelineSync = (character: TimelineCharacter) => void

function characterKey({ serverId, characterId }: TimelineCharacter): string {
  return `${serverId}/${characterId}`
}

export interface TimelineSyncQueue {
  request: RequestTimelineSync
  // request와 같이 넣고, 그 캐릭터의 동기화가 성공하든 실패하든 끝나면 풀린다.
  // 닫은 뒤 새로 온 요청은 바로 풀리고, 진행 중인 동기화는 끝을 기다린다.
  requestAndWait(character: TimelineCharacter): Promise<void>
  // 진행 중인 동기화는 그대로 두고 이후 요청은 무시한다.
  close(): void
}

export function createTimelineSyncQueue(
  sync: (character: TimelineCharacter) => Promise<void>,
  reportFailure: () => void
): TimelineSyncQueue {
  const running = new Map<string, Promise<void>>()
  let closed = false

  const start = (character: TimelineCharacter): Promise<void> | undefined => {
    const key = characterKey(character)
    const existing = running.get(key)
    if (existing !== undefined || closed) {
      return existing
    }
    // 동기화는 실패를 직접 기록하므로 여기 오는 것은 그 기록마저 실패한 경우이고, 백필은 실패를 그대로 던진다.
    const finished = sync(character)
      .catch(reportFailure)
      .finally(() => {
        running.delete(key)
      })
    running.set(key, finished)

    return finished
  }

  return {
    request(character) {
      start(character)
    },
    async requestAndWait(character) {
      await start(character)
    },
    close() {
      closed = true
    }
  }
}
