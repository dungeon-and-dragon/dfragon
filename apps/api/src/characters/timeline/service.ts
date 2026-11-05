import type { TimelineCharacter } from '@dfragon/database'
import type { TimelineSyncQueue } from './queue.js'
import { type CharacterTimeline, EMPTY_CHARACTER_TIMELINE } from './read.js'

export interface CharacterTimelineService {
  get(character: TimelineCharacter): Promise<CharacterTimeline>
}

export const emptyCharacterTimelineService: CharacterTimelineService = {
  get: async () => EMPTY_CHARACTER_TIMELINE
}

export function createCharacterTimelineService(
  queue: TimelineSyncQueue,
  read: (character: TimelineCharacter) => Promise<CharacterTimeline>
): CharacterTimelineService {
  return {
    async get(character) {
      // 처음 조회한 캐릭터는 DB가 비어 있을 수 있어, 그 캐릭터의 동기화가 끝난 뒤 읽는다.
      await queue.requestAndWait(character)

      return read(character)
    }
  }
}
