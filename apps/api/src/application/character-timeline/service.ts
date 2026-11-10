import type { TimelineCharacter } from '@dfragon/database'
import type { ReadTimelinePage } from './ports.js'
import type { TimelineSyncQueue } from './queue.js'
import {
  type CharacterTimeline,
  EMPTY_CHARACTER_TIMELINE,
  EMPTY_TIMELINE_PAGE
} from '../../domain/character-timeline/project.js'

export interface CharacterTimelineService {
  get(character: TimelineCharacter): Promise<CharacterTimeline>
  page: ReadTimelinePage
}

export const emptyCharacterTimelineService: CharacterTimelineService = {
  get: async () => EMPTY_CHARACTER_TIMELINE,
  page: async () => EMPTY_TIMELINE_PAGE
}

export function createCharacterTimelineService(
  queue: TimelineSyncQueue,
  read: (character: TimelineCharacter) => Promise<CharacterTimeline>,
  readPage: ReadTimelinePage
): CharacterTimelineService {
  return {
    async get(character) {
      // 처음 조회한 캐릭터는 DB가 비어 있을 수 있어, 그 캐릭터의 동기화가 끝난 뒤 읽는다.
      await queue.requestAndWait(character)

      return read(character)
    },
    // 이어 받기는 첫 조회 뒤에만 오므로 동기화를 기다리지 않고 저장한 값을 읽는다.
    page: readPage
  }
}
