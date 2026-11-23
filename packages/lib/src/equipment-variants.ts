import table from './equipment-variants.json' with { type: 'json' }

export const EQUIPMENT_VARIANT_SLOTS = [
  'JACKET',
  'SHOULDER',
  'PANTS',
  'SHOES',
  'WAIST',
  'AMULET',
  'WRIST',
  'RING',
  'SUPPORT',
  'MAGIC_STON',
  'EARRING'
] as const

export type EquipmentVariantSlot = (typeof EQUIPMENT_VARIANT_SLOTS)[number]

export type EquipmentVariantKind = '일반' | '잠식' | '축성' | '흑아' | '유일'

export interface EquipmentVariantItem {
  readonly itemId: string
  readonly itemName: string
  readonly itemRarity: string
}

/** id는 대표 아이템의 itemId다. tuneSetPoints[n]은 조율 n단계의 세트 포인트다. */
export interface EquipmentVariant {
  readonly id: string
  readonly rarity: string
  readonly kind: EquipmentVariantKind
  readonly item: EquipmentVariantItem
  readonly tuneSetPoints: readonly number[]
  /** 방어구 5부위가 모두 축성일 때 item 대신 계산에 넣는 세트 공용 이름 아이템이다. */
  readonly consecrated?: EquipmentVariantItem
  readonly otherItemIds?: readonly string[]
}

/** setItemId가 null이면 세트 밖의 유일 장비다. */
export interface EquipmentVariantMatch {
  readonly setItemId: string | null
  readonly slotId: EquipmentVariantSlot
  readonly variant: EquipmentVariant
}

export interface OathCrystal {
  readonly name: string
  readonly rarity: string
  readonly tuneSetPoints: readonly number[]
}

export type EquipmentVariantSelection = Readonly<
  Partial<Record<EquipmentVariantSlot, EquipmentVariant>>
>

export type EquipmentVariantItems = Readonly<
  Partial<Record<EquipmentVariantSlot, EquipmentVariantItem>>
>

interface EquipmentVariantSet {
  readonly setItemId: string
  readonly setItemName: string
  readonly slots: Readonly<Record<EquipmentVariantSlot, readonly EquipmentVariant[]>>
}

type ExaltedSlot = 'RING' | 'SUPPORT' | 'MAGIC_STON' | 'EARRING'

interface EquipmentVariantTable {
  readonly version: 1
  readonly sets: readonly EquipmentVariantSet[]
  readonly exalted: Readonly<Record<ExaltedSlot, EquipmentVariant>>
  readonly oathCrystals: readonly OathCrystal[]
}

// 생성 스크립트가 만든 파일을 그대로 두므로 모양은 테스트가 확인한다.
const variantTable = table as EquipmentVariantTable

const ARMOR_SLOTS = ['JACKET', 'SHOULDER', 'PANTS', 'SHOES', 'WAIST'] as const

function exaltedOf(slotId: EquipmentVariantSlot): EquipmentVariant[] {
  const exalted: Partial<Record<EquipmentVariantSlot, EquipmentVariant>> = variantTable.exalted
  const variant = exalted[slotId]

  if (variant === undefined) {
    return []
  }

  return [variant]
}

const variantsBySet = new Map(
  variantTable.sets.map(({ setItemId, slots }) => [
    setItemId,
    new Map(
      EQUIPMENT_VARIANT_SLOTS.map((slotId) => [slotId, [...slots[slotId], ...exaltedOf(slotId)]])
    )
  ])
)

function matchesOf({ setItemId, slots }: EquipmentVariantSet): [string, EquipmentVariantMatch][] {
  return EQUIPMENT_VARIANT_SLOTS.flatMap((slotId) =>
    slots[slotId].flatMap((variant) => {
      const match = { setItemId, slotId, variant }
      const itemIds = [variant.item.itemId, ...(variant.otherItemIds ?? [])]

      if (variant.consecrated !== undefined) {
        itemIds.push(variant.consecrated.itemId)
      }

      return itemIds.map((itemId): [string, EquipmentVariantMatch] => [itemId, match])
    })
  )
}

const exaltedMatches = EQUIPMENT_VARIANT_SLOTS.flatMap((slotId) =>
  exaltedOf(slotId).map((variant): [string, EquipmentVariantMatch] => [
    variant.item.itemId,
    { setItemId: null, slotId, variant }
  ])
)
const matchesByItemId = new Map([...variantTable.sets.flatMap(matchesOf), ...exaltedMatches])
const oathCrystalsByName = new Map(
  variantTable.oathCrystals.map((crystal) => [crystal.name, crystal])
)

export function equipmentVariantsOf(
  setItemId: string,
  slotId: EquipmentVariantSlot
): readonly EquipmentVariant[] {
  const variants = variantsBySet.get(setItemId)?.get(slotId)

  if (variants === undefined) {
    return []
  }

  return variants
}

export function findEquipmentVariant(itemId: string): EquipmentVariantMatch | null {
  const match = matchesByItemId.get(itemId)

  if (match === undefined) {
    return null
  }

  return match
}

export function resolveEquipmentItems(selection: EquipmentVariantSelection): EquipmentVariantItems {
  const consecrated = ARMOR_SLOTS.every((slotId) => selection[slotId]?.kind === '축성')

  return Object.fromEntries(
    EQUIPMENT_VARIANT_SLOTS.flatMap((slotId) => {
      const variant = selection[slotId]

      if (variant === undefined) {
        return []
      }

      const item = consecrated ? (variant.consecrated ?? variant.item) : variant.item

      return [[slotId, item]]
    })
  )
}

export function findOathCrystal(itemName: string): OathCrystal | null {
  const crystal = oathCrystalsByName.get(itemName)

  if (crystal === undefined) {
    return null
  }

  return crystal
}
