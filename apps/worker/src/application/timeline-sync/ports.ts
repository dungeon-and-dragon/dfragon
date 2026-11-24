import type { ItemDictionaryService } from '@dfragon/server-core/application/item-dictionary/index.js'
import type { FetchCharacterTimeline } from '@dfragon/server-core/application/character-timeline/ports.js'
import type { Pause } from '#application/character-collection/ports.js'

export type TimelineSyncRequestPorts = {
  fetchTimeline: FetchCharacterTimeline
  fetchEnhancementTimeline: FetchCharacterTimeline
  itemDictionary: Pick<ItemDictionaryService, 'fill'>
  report: (code: string, details?: Readonly<Record<string, string>>) => void
  pause: Pause
}
