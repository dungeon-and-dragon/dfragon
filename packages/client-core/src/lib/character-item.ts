const ITEM_ICON_ORIGIN = 'https://img-api.neople.co.kr'

export type ItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'unique'
  | 'legendary'
  | 'epic'
  | 'chronicle'
  | 'primordial'
  | 'mythic'

const RARITY_BY_NAME: ReadonlyMap<string, ItemRarity> = new Map([
  ['커먼', 'common'],
  ['언커먼', 'uncommon'],
  ['레어', 'rare'],
  ['유니크', 'unique'],
  ['레전더리', 'legendary'],
  ['에픽', 'epic'],
  ['크로니클', 'chronicle'],
  ['태초', 'primordial'],
  ['신화', 'mythic']
])

const TUNE_NUMERALS = ['I', 'II', 'III', 'IV', 'V']
const WHITESPACE_PATTERN = /\s+/

const integer = new Intl.NumberFormat('ko-KR')

export type ItemView = Readonly<{
  itemId: string | null
  itemName: string | null
  rarity: ItemRarity | null
}>

export type StatLine = Readonly<{ name: string; value: string }>

export function itemIconUrl(itemId: string): string {
  return `${ITEM_ICON_ORIGIN}/df/items/${encodeURIComponent(itemId)}`
}

// 서약 세트 등급은 "레어 Ⅱ"처럼 등급 뒤에 단계가 붙어 오므로 첫 단어만 희귀도로 읽는다.
export function itemRarity(name: string | null): ItemRarity | null {
  const head = name?.trim().split(WHITESPACE_PATTERN)[0]

  if (head === undefined) {
    return null
  }

  const rarity = RARITY_BY_NAME.get(head)

  if (rarity === undefined) {
    return null
  }

  return rarity
}

export function toItemView(item: {
  itemId: string | null
  itemName: string | null
  itemRarity: string | null
}): ItemView {
  return { itemId: item.itemId, itemName: item.itemName, rarity: itemRarity(item.itemRarity) }
}

export function tuneNumeral(level: number | null): string | null {
  if (level == null || level < 1) {
    return null
  }

  const numeral = TUNE_NUMERALS[level - 1]

  if (numeral === undefined) {
    return null
  }

  return numeral
}

export function formatCount(value: number): string {
  return integer.format(value)
}

export function formatPoint(value: number): string {
  return `${integer.format(value)}pt`
}

export function formatStatValue(value: number | string): string {
  if (typeof value === 'number') {
    return integer.format(value)
  }

  return value
}

export function toStatLines(
  stats: readonly { key: string | null; value: number | string | null }[]
): StatLine[] {
  return stats.flatMap(({ key, value }) =>
    key != null && value != null ? [{ name: key, value: formatStatValue(value) }] : []
  )
}
