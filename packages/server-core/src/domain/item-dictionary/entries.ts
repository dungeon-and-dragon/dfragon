import type { ItemDictionaryEntry, TimelineItemInput } from '@dfragon/database'
import { range } from 'remeda'
import { z } from 'zod'

export const EQUIPMENT_ACQUISITION_CODES: readonly number[] = range(501, 522)
// 서약 획득 가운데 554(제작서), 555(무기고)는 같은 itemId의 다른 기록과 등급이 다르게 찍혀, 서약은 등급으로 거르지 않는다.
export const OATH_ACQUISITION_CODES: readonly number[] = range(550, 558)
export const ITEM_DICTIONARY_RARITIES = ['레전더리', '에픽', '태초', '신화'] as const
// 중천(시즌 10) 시작이다. 타임라인 정기 동기화가 이때부터 받는다.
export const ITEM_DICTIONARY_SINCE = new Date('2025-01-09T06:00:00+09:00')

const equipmentCodes: ReadonlySet<number> = new Set(EQUIPMENT_ACQUISITION_CODES)
const oathCodes: ReadonlySet<number> = new Set(OATH_ACQUISITION_CODES)
const dictionaryRarities: ReadonlySet<string | null> = new Set(ITEM_DICTIONARY_RARITIES)

function isDictionaryAcquisition({ code, itemRarity }: TimelineItemInput): boolean {
  return oathCodes.has(code) || (equipmentCodes.has(code) && dictionaryRarities.has(itemRarity))
}

export function dictionaryItemIds(items: readonly TimelineItemInput[]): string[] {
  const itemIds = new Set<string>()

  for (const item of items) {
    if (item.itemId !== null && isDictionaryAcquisition(item)) {
      itemIds.add(item.itemId)
    }
  }

  return [...itemIds]
}

const nullableText = z.string().nullable().catch(null)
const itemDetail = z.object({
  itemAvailableLevel: z.number().int().nullable().catch(null),
  itemType: nullableText,
  itemTypeDetail: nullableText,
  itemRarity: nullableText,
  setItemId: nullableText,
  setItemName: nullableText
})

export function toItemDictionaryEntry(
  itemId: string,
  detail: Readonly<Record<string, unknown>> | undefined
): ItemDictionaryEntry {
  if (detail === undefined) {
    return {
      itemId,
      availableLevel: null,
      itemType: null,
      itemTypeDetail: null,
      itemRarity: null,
      setItemId: null,
      setItemName: null
    }
  }

  const { itemAvailableLevel, ...fields } = itemDetail.parse(detail)

  return { itemId, availableLevel: itemAvailableLevel, ...fields }
}
