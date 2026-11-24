import type { TimelineCharacter, TimelineItemCursor } from '@dfragon/database'
import {
  type CharacterTimeline,
  EMPTY_CHARACTER_TIMELINE,
  EMPTY_TIMELINE_PAGE,
  type TimelineItemPage,
  type TimelinePageList
} from '@dfragon/server-core/domain/character-timeline/index.js'
import type { CharacterTimelineRepository } from './repository.js'
import type { TimelineSyncRequestService } from './sync-requests.js'

export type TimelineSyncWaiter = Pick<TimelineSyncRequestService, 'syncAndWait'>

export class CharacterTimelineService {
  constructor(
    private readonly repository: CharacterTimelineRepository,
    private readonly sync: TimelineSyncWaiter
  ) {}

  async get(character: TimelineCharacter): Promise<CharacterTimeline> {
    // 처음 조회한 캐릭터는 DB가 비어 있을 수 있어, 그 캐릭터의 동기화를 기다린 뒤 읽는다.
    await this.sync.syncAndWait(character)

    return this.repository.readTimeline(character)
  }

  // 이어 받기는 첫 조회 뒤에만 오므로 동기화를 기다리지 않고 저장한 값을 읽는다.
  page(
    character: TimelineCharacter,
    list: TimelinePageList,
    before: TimelineItemCursor
  ): Promise<TimelineItemPage> {
    return this.repository.readPage(character, list, before)
  }
}

export const noTimelineSync: TimelineSyncWaiter = {
  syncAndWait: async () => undefined
}

export const emptyCharacterTimelineRepository: CharacterTimelineRepository = {
  readTimeline: async () => EMPTY_CHARACTER_TIMELINE,
  readPage: async () => EMPTY_TIMELINE_PAGE
}
