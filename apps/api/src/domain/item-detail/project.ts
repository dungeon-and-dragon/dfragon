import { z } from 'zod'

export interface ItemStatus {
  name: string
  value: string
}

export interface ItemDetail {
  itemId: string
  name: string
  rarity: string | null
  itemType: string | null
  typeDetail: string | null
  availableLevel: number | null
  fame: number | null
  status: ItemStatus[]
  explain: string | null
  flavorText: string | null
}

function presentText(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') {
    return null
  }

  return value
}

const text = z.string().nullish().transform(presentText)
const count = z.number().nullable().default(null)
const status = z
  .array(z.object({ name: z.string(), value: z.union([z.number(), z.string()]) }))
  .nullish()
  .transform((rows) => (rows ?? []).map(({ name, value }) => ({ name, value: String(value) })))

const neopleItem = z.object({
  itemName: z.string(),
  itemRarity: text,
  itemType: text,
  itemTypeDetail: text,
  itemAvailableLevel: count,
  fame: count,
  itemStatus: status,
  itemExplain: text,
  itemExplainDetail: text,
  itemFlavorText: text
})

export function projectItemDetail(itemId: string, data: unknown): ItemDetail | null {
  const parsed = neopleItem.safeParse(data)

  if (!parsed.success) {
    return null
  }

  const item = parsed.data
  // 상세 설명이 결투장 적용 같은 문구와 줄바꿈까지 담아 인게임 툴팁에 더 가깝다.
  const explain = item.itemExplainDetail ?? item.itemExplain

  return {
    itemId,
    name: item.itemName,
    rarity: item.itemRarity,
    itemType: item.itemType,
    typeDetail: item.itemTypeDetail,
    availableLevel: item.itemAvailableLevel,
    fame: item.fame,
    status: item.itemStatus,
    explain,
    flavorText: item.itemFlavorText
  }
}
