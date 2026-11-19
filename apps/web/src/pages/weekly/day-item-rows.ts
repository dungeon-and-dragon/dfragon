import type { ActivityDayItem } from '#entities/adventure-guild'

export type DayItemRow =
  | Readonly<{ kind: 'item'; item: ActivityDayItem }>
  | Readonly<{ kind: 'count'; rarity: string; count: number }>

export type DayItemGroups = Readonly<{
  items: readonly DayItemRow[]
  oaths: readonly DayItemRow[]
}>

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

function namedRows(items: readonly ActivityDayItem[]): DayItemRow[] {
  const named = NAMED_RARITIES.flatMap((rarity) =>
    items.filter((item) => item.rarity === rarity).map(itemRow)
  )

  return [...named, ...countRows(items, COUNTED_RARITIES)]
}

function rowCount({ items, oaths }: DayItemGroups): number {
  return items.length + oaths.length
}

// 장비와 서약은 시간순으로 들어온다. 두 묶음의 줄을 합쳐 8줄을 넘는지 보고, 두 묶음을 같은 단계로 줄인다.
export function dayItemGroups(
  items: readonly ActivityDayItem[],
  oaths: readonly ActivityDayItem[]
): DayItemGroups {
  if (items.length + oaths.length <= MAX_DAY_ITEM_ROWS) {
    const itemRows = items.map(itemRow)
    const oathRows = oaths.map(itemRow)

    return { items: itemRows, oaths: oathRows }
  }

  const namedItems = namedRows(items)
  const namedOaths = namedRows(oaths)
  const named = { items: namedItems, oaths: namedOaths }

  if (rowCount(named) <= MAX_DAY_ITEM_ROWS) {
    return named
  }

  const rarities = [...NAMED_RARITIES, ...COUNTED_RARITIES]
  const countedItems = countRows(items, rarities)
  const countedOaths = countRows(oaths, rarities)

  return { items: countedItems, oaths: countedOaths }
}
