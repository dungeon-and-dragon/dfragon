import type { ItemDictionaryEntry, TimelineItemInput } from '@dfragon/database'
import { range } from 'remeda'
import { z } from 'zod'

// 획득 코드 501~521이다. 서약 획득(550~557)은 code로 가르므로 사전에 넣지 않는다.
export const ITEM_DICTIONARY_CODES: readonly number[] = range(501, 522)
export const ITEM_DICTIONARY_RARITIES = ['레전더리', '에픽', '태초', '신화'] as const
// 중천(시즌 10) 시작이다. 타임라인 정기 동기화가 이때부터 받는다.
export const ITEM_DICTIONARY_SINCE = new Date('2025-01-09T06:00:00+09:00')

const dictionaryCodes: ReadonlySet<number> = new Set(ITEM_DICTIONARY_CODES)
const dictionaryRarities: ReadonlySet<string | null> = new Set(ITEM_DICTIONARY_RARITIES)

export function dictionaryItemIds(items: readonly TimelineItemInput[]): string[] {
  const itemIds = new Set<string>()

  for (const { code, itemId, itemRarity } of items) {
    if (itemId !== null && dictionaryCodes.has(code) && dictionaryRarities.has(itemRarity)) {
      itemIds.add(itemId)
    }
  }

  return [...itemIds]
}

const itemDetail = z.object({
  itemAvailableLevel: z.number().int().nullable().catch(null),
  itemType: z.string().nullable().catch(null)
})

export function toItemDictionaryEntry(
  itemId: string,
  detail: Readonly<Record<string, unknown>> | undefined
): ItemDictionaryEntry {
  if (detail === undefined) {
    return { itemId, availableLevel: null, itemType: null }
  }

  const { itemAvailableLevel, itemType } = itemDetail.parse(detail)

  return { itemId, availableLevel: itemAvailableLevel, itemType }
}
