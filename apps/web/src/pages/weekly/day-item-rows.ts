import type { ActivityDayItem } from '#core/adventure-guild/adventure-activity'

export type DayItemRow =
  | Readonly<{ kind: 'item'; item: ActivityDayItem }>
  | Readonly<{ kind: 'count'; rarity: string; count: number }>

const MAX_DAY_ITEM_ROWS = 8

const NAMED_RARITIES = ['신화', '태초']
const COUNTED_RARITIES = ['에픽', '레전더리']

function itemRow(item: ActivityDayItem): DayItemRow {
  return { kind: 'item', item }
}

function countRows(items: readonly ActivityDayItem[], rarities: readonly string[]): DayItemRow[] {
  return rarities.flatMap((rarity): DayItemRow[] => {
    const count = items.filter((item) => item.rarity === rarity).length
    if (count === 0) {
      return []
    }

    return [{ kind: 'count', rarity, count }]
  })
}

// 아이템은 시간순으로 들어온다.
export function dayItemRows(items: readonly ActivityDayItem[]): DayItemRow[] {
  if (items.length <= MAX_DAY_ITEM_ROWS) {
    return items.map(itemRow)
  }

  const named = NAMED_RARITIES.flatMap((rarity) =>
    items.filter((item) => item.rarity === rarity).map(itemRow)
  )
  const rows = [...named, ...countRows(items, COUNTED_RARITIES)]
  if (rows.length <= MAX_DAY_ITEM_ROWS) {
    return rows
  }

  return countRows(items, [...NAMED_RARITIES, ...COUNTED_RARITIES])
}
