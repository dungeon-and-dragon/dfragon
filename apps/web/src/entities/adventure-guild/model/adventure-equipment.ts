import { z } from 'zod'
import { storedCharacterSchema } from '#entities/ranking/@x/adventure-guild'

export const EQUIPMENT_SLOTS = [
  '상의',
  '머리어깨',
  '하의',
  '신발',
  '벨트',
  '목걸이',
  '팔찌',
  '반지',
  '보조장비',
  '마법석',
  '귀걸이'
] as const

// 높은 등급부터 둔다. 서약 결정 열도 이 순서다. 레전더리 이하는 보이지 않는다.
export const HOLDING_RARITIES = ['태초', '에픽'] as const

const PRIMEVAL_SLOTS: readonly EquipmentSlot[] = ['목걸이', '팔찌', '반지']
const NON_PRIMEVAL_RARITIES = ['에픽'] as const

const holdingSchema = z.object({
  setItemId: z.string(),
  rarity: z.string(),
  itemId: z.string(),
  itemName: z.string(),
  count: z.number().int().positive()
})

const equipmentCharacterSchema = storedCharacterSchema.extend({
  equipment: z.array(holdingSchema.extend({ slot: z.string() })),
  oaths: z.array(holdingSchema.extend({ kind: z.enum(['oath', 'crystal']) }))
})

export const adventureEquipmentSchema = z.object({
  adventureName: z.string(),
  sets: z.array(z.object({ setItemId: z.string(), setItemName: z.string() })),
  servers: z.array(
    z.object({ serverId: z.string(), characters: z.array(equipmentCharacterSchema) })
  ),
  selected: z.object({ serverId: z.string(), setItemId: z.string().nullable() }).nullable()
})

export type AdventureEquipment = z.infer<typeof adventureEquipmentSchema>
export type EquipmentSelection = NonNullable<AdventureEquipment['selected']>
export type EquipmentCharacter = z.infer<typeof equipmentCharacterSchema>
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number]

type Holding = z.infer<typeof holdingSchema>

export type HoldingCell = Readonly<{
  itemId: string
  itemName: string
  rarity: string
  extraCount: number
  rarityCounts: readonly Readonly<{ rarity: string; count: number }>[]
}>

export type CrystalCell = Readonly<{
  itemId: string
  itemName: string
  rarity: string
  count: number
}>

export type EquipmentBoardRow = Readonly<{
  character: EquipmentCharacter
  slots: readonly Readonly<{ slot: EquipmentSlot; cell: HoldingCell | null }>[]
  oath: HoldingCell | null
  crystals: readonly (CrystalCell | null)[]
}>

function rarityRank(rarity: string): number {
  return HOLDING_RARITIES.findIndex((name) => name === rarity)
}

function isShownRarity(holding: Holding): boolean {
  return rarityRank(holding.rarity) !== -1
}

function toCrystalCells(crystals: readonly Holding[]): (CrystalCell | null)[] {
  return HOLDING_RARITIES.map((rarity) => {
    const holdings = crystals.filter((holding) => holding.rarity === rarity)
    const first = holdings[0]

    if (first === undefined) {
      return null
    }

    const count = holdings.reduce((sum, holding) => sum + holding.count, 0)

    return { itemId: first.itemId, itemName: first.itemName, rarity, count }
  })
}

function countByRarity(
  holdings: readonly Holding[],
  rarities: readonly string[]
): HoldingCell['rarityCounts'] {
  return rarities.map((rarity) => {
    const count = holdings
      .filter((holding) => holding.rarity === rarity)
      .reduce((sum, holding) => sum + holding.count, 0)

    return { rarity, count }
  })
}

function slotRarities(slot: EquipmentSlot): readonly string[] {
  if (PRIMEVAL_SLOTS.includes(slot)) {
    return HOLDING_RARITIES
  }

  return NON_PRIMEVAL_RARITIES
}

function toCell(
  holdings: readonly Holding[],
  rarities: readonly string[] = HOLDING_RARITIES
): HoldingCell | null {
  const top = holdings.toSorted((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity))[0]

  if (top === undefined) {
    return null
  }

  const rarityCounts = countByRarity(holdings, rarities)
  const topCount = holdings
    .filter(({ rarity }) => rarity === top.rarity)
    .reduce((sum, { count }) => sum + count, 0)
  const extraCount = topCount - 1

  return {
    itemId: top.itemId,
    itemName: top.itemName,
    rarity: top.rarity,
    extraCount,
    rarityCounts
  }
}

function toSlots(equipment: EquipmentCharacter['equipment']): EquipmentBoardRow['slots'] {
  return EQUIPMENT_SLOTS.map((slot) => {
    const holdings = equipment.filter((holding) => holding.slot === slot)
    const cell = toCell(holdings, slotRarities(slot))

    return { slot, cell }
  })
}

function compareFame(a: EquipmentCharacter, b: EquipmentCharacter): number {
  return (b.fame ?? -1) - (a.fame ?? -1)
}

export function toEquipmentBoard(
  characters: readonly EquipmentCharacter[],
  setItemId: string | undefined
): EquipmentBoardRow[] {
  return characters.toSorted(compareFame).map((character) => {
    const equipment = character.equipment.filter(
      (holding) => holding.setItemId === setItemId && isShownRarity(holding)
    )
    const oaths = character.oaths.filter(
      (holding) => holding.setItemId === setItemId && isShownRarity(holding)
    )
    const crystals = toCrystalCells(oaths.filter(({ kind }) => kind === 'crystal'))
    const slots = toSlots(equipment)
    const oath = toCell(oaths.filter(({ kind }) => kind === 'oath'))

    return { character, slots, oath, crystals }
  })
}
