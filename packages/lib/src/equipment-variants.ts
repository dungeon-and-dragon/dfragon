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

/** null은 선택지에 없는 착용 아이템이다. switchEquipmentSet의 결과에서는 착용 아이템을 그대로 둔다는 뜻이다. */
export type EquipmentSetSelection = Readonly<
  Partial<Record<EquipmentVariantSlot, EquipmentVariant | null>>
>

export interface EquipmentSet {
  readonly setItemId: string
  readonly setItemName: string
}

export interface OathSet {
  readonly setId: number
  readonly name: string
}

export interface OathVariant {
  readonly id: string
  readonly rarity: string
  readonly item: EquipmentVariantItem
  readonly setPoint: number
  readonly otherItemIds?: readonly string[]
}

/** setId가 null이면 세트에 속하지 않는 영겁의 안개 서약이다. */
export interface OathVariantMatch {
  readonly setId: number | null
  readonly variant: OathVariant
}

export interface OathCrystalVariant {
  readonly id: string
  readonly rarity: string
  readonly item: EquipmentVariantItem
  readonly tuneSetPoints: readonly number[]
  readonly otherItemIds?: readonly string[]
}

export interface OathCrystalVariantMatch {
  readonly setId: number
  readonly variant: OathCrystalVariant
}

export type WeaponVariantLine = '기본' | '해방' | '태초의 별'

/**
 * id는 대표 아이템의 itemId다. line이 null이면 계열이 없는 유니크다. tuned는 조율을 마친 태초 기본 계열 아이템이고,
 * releasePending은 해방 계열에서 해방 수치가 100 미만일 때의 아이템이다.
 */
export interface WeaponVariant {
  readonly id: string
  readonly rarity: string
  readonly line: WeaponVariantLine | null
  readonly tuned: boolean
  readonly maxTuneLevel: number
  readonly item: EquipmentVariantItem
  readonly releasePending?: EquipmentVariantItem
}

export interface WeaponVariantMatch {
  readonly itemTypeDetail: string
  readonly variant: WeaponVariant
}

interface WeaponVariantType {
  readonly itemTypeDetail: string
  readonly variants: readonly WeaponVariant[]
}

interface EquipmentVariantSet extends EquipmentSet {
  readonly slots: Readonly<Record<EquipmentVariantSlot, readonly EquipmentVariant[]>>
}

export type OathUpgradeKind =
  | 'Damage'
  | 'Cooltime'
  | 'Oathpoint'
  | 'Speed'
  | 'SkillRange'
  | 'DamageReduce'

/** option은 엔진에 넘기는 선택지 이름이다. */
export interface OathUpgradeOption {
  readonly option: string
  readonly kind: OathUpgradeKind
}

export interface OathUpgradeStep {
  readonly step: number
  readonly name: string
  readonly options: readonly OathUpgradeOption[]
}

export interface OathUpgradeSelection {
  readonly step: number
  readonly option: string
}

interface OathVariantSet extends OathSet {
  readonly oaths: readonly OathVariant[]
  readonly crystals: readonly OathCrystalVariant[]
}

type ExaltedSlot = 'RING' | 'SUPPORT' | 'MAGIC_STON' | 'EARRING'

interface EquipmentVariantTable {
  readonly version: 1
  readonly sets: readonly EquipmentVariantSet[]
  readonly exalted: Readonly<Record<ExaltedSlot, EquipmentVariant>>
  readonly oathCrystals: readonly OathCrystal[]
  readonly oathSets: readonly OathVariantSet[]
  readonly mistOaths: readonly OathVariant[]
  readonly weaponMaxTuneLevels: Readonly<Record<string, number>>
  readonly weapons: readonly WeaponVariantType[]
  readonly oathUpgradeMaxStep: number
  readonly oathUpgradeSteps: readonly OathUpgradeStep[]
}

// 생성 스크립트가 만든 파일을 그대로 두므로 모양은 테스트가 확인한다.
const variantTable = table as EquipmentVariantTable

// 게임에서 태초 서약 결정은 캐릭터당 3개까지만 낄 수 있다(저장소 소유자 규칙).
export const PRIMEVAL_OATH_CRYSTAL_LIMIT = 3

export const OATH_UPGRADE_MAX_STEP: number = variantTable.oathUpgradeMaxStep

export const WEAPON_RELEASE_MAX = 100

const ARMOR_SLOTS = ['JACKET', 'SHOULDER', 'PANTS', 'SHOES', 'WAIST'] as const
const RARITY_ORDER = ['유니크', '레전더리', '에픽', '태초']

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
const equipmentSetList: readonly EquipmentSet[] = variantTable.sets.map(
  ({ setItemId, setItemName }) => ({ setItemId, setItemName })
)
const oathSetList: readonly OathSet[] = variantTable.oathSets.map(({ setId, name }) => ({
  setId,
  name
}))
const weaponMaxTuneLevels = new Map(Object.entries(variantTable.weaponMaxTuneLevels))
const oathSetsById = new Map(variantTable.oathSets.map((oathSet) => [oathSet.setId, oathSet]))
const weaponVariantsByType = new Map(
  variantTable.weapons.map(({ itemTypeDetail, variants }) => [itemTypeDetail, variants])
)
const weaponMatchesByItemId = new Map(
  variantTable.weapons.flatMap(({ itemTypeDetail, variants }) =>
    variants.flatMap((variant) => {
      const match = { itemTypeDetail, variant }
      const items =
        variant.releasePending !== undefined
          ? [variant.item, variant.releasePending]
          : [variant.item]

      return items.map(({ itemId }): [string, WeaponVariantMatch] => [itemId, match])
    })
  )
)

function itemIdsOf(variant: OathVariant | OathCrystalVariant): string[] {
  return [variant.item.itemId, ...(variant.otherItemIds ?? [])]
}

function oathMatchesOf(setId: number | null, oaths: readonly OathVariant[]) {
  return oaths.flatMap((variant) =>
    itemIdsOf(variant).map((itemId): [string, OathVariantMatch] => [itemId, { setId, variant }])
  )
}

const oathMatchesByItemId = new Map([
  ...variantTable.oathSets.flatMap(({ setId, oaths }) => oathMatchesOf(setId, oaths)),
  ...oathMatchesOf(null, variantTable.mistOaths)
])
const oathCrystalMatchesByItemId = new Map(
  variantTable.oathSets.flatMap(({ setId, crystals }) =>
    crystals.flatMap((variant) =>
      itemIdsOf(variant).map((itemId): [string, OathCrystalVariantMatch] => [
        itemId,
        { setId, variant }
      ])
    )
  )
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

export function equipmentSets(): readonly EquipmentSet[] {
  return equipmentSetList
}

function rarityRankOf(rarity: string): number {
  return RARITY_ORDER.indexOf(rarity)
}

function highestVariantOf(variants: readonly EquipmentVariant[]): EquipmentVariant | null {
  const normal = variants.filter(({ kind }) => kind === '일반')
  const [highest] = normal.sort((a, b) => rarityRankOf(b.rarity) - rarityRankOf(a.rarity))

  if (highest === undefined) {
    return null
  }

  return highest
}

function switchedVariantOf(
  variant: EquipmentVariant | null,
  variants: readonly EquipmentVariant[]
): EquipmentVariant | null {
  if (variant === null || variant.kind === '유일') {
    return null
  }

  const same = variants.find(
    ({ rarity, kind }) => rarity === variant.rarity && kind === variant.kind
  )

  if (same !== undefined) {
    return same
  }

  return highestVariantOf(variants)
}

export function switchEquipmentSet(
  selection: EquipmentSetSelection,
  setItemId: string
): EquipmentSetSelection {
  const slots = variantsBySet.get(setItemId)

  if (slots === undefined) {
    throw new Error(`Unknown equipment set: ${setItemId}`)
  }

  return Object.fromEntries(
    EQUIPMENT_VARIANT_SLOTS.flatMap((slotId) => {
      const variant = selection[slotId]

      if (variant === undefined) {
        return []
      }

      return [[slotId, switchedVariantOf(variant, slots.get(slotId) ?? [])]]
    })
  )
}

export function oathSets(): readonly OathSet[] {
  return oathSetList
}

export function oathVariantsOf(setId: number | null): readonly OathVariant[] {
  if (setId === null) {
    return variantTable.mistOaths
  }

  const oathSet = oathSetsById.get(setId)

  if (oathSet === undefined) {
    return []
  }

  return oathSet.oaths
}

export function oathVariantOf(setId: number | null, rarity: string): OathVariant | null {
  const variant = oathVariantsOf(setId).find((oath) => oath.rarity === rarity)

  if (variant === undefined) {
    return null
  }

  return variant
}

export function findOathVariant(itemId: string): OathVariantMatch | null {
  const match = oathMatchesByItemId.get(itemId)

  if (match === undefined) {
    return null
  }

  return match
}

export function oathCrystalVariantsOf(setId: number): readonly OathCrystalVariant[] {
  const oathSet = oathSetsById.get(setId)

  if (oathSet === undefined) {
    return []
  }

  return oathSet.crystals
}

export function findOathCrystalVariant(itemId: string): OathCrystalVariantMatch | null {
  const match = oathCrystalMatchesByItemId.get(itemId)

  if (match === undefined) {
    return null
  }

  return match
}

/** 광휘 결정이 아니면 바꿔 넣을 짝이 없어 null을 돌려준다. */
export function moveOathCrystalToSet(itemId: string, setId: number): OathCrystalVariant | null {
  const crystals = oathCrystalVariantsOf(setId)

  if (crystals.length === 0) {
    throw new Error(`Unknown oath set: ${setId}`)
  }

  const match = findOathCrystalVariant(itemId)

  if (match === null) {
    return null
  }

  const moved = crystals.find(({ rarity }) => rarity === match.variant.rarity)

  if (moved === undefined) {
    return null
  }

  return moved
}

/** 목록에 없는 무기는 조율할 수 없어 0이다. */
export function weaponMaxTuneLevelOf(itemName: string): number {
  const level = weaponMaxTuneLevels.get(itemName)

  if (level === undefined) {
    return 0
  }

  return level
}

/** 무기 종류(Neople itemTypeDetail) 안에서 바꿀 수 있는 115레벨 무기 선택지다. */
export function weaponVariantsOf(itemTypeDetail: string): readonly WeaponVariant[] {
  const variants = weaponVariantsByType.get(itemTypeDetail)

  if (variants === undefined) {
    return []
  }

  return variants
}

/** 해방 계열의 "억압 - " 아이템도 그 선택지로 찾는다. */
export function findWeaponVariant(itemId: string): WeaponVariantMatch | null {
  const match = weaponMatchesByItemId.get(itemId)

  if (match === undefined) {
    return null
  }

  return match
}

/** 해방 계열은 해방 수치가 다 차야 대표 아이템이고, 그 전에는 "억압 - " 아이템이다. */
export function weaponItemOf(variant: WeaponVariant, release: number): EquipmentVariantItem {
  if (variant.releasePending === undefined || release >= WEAPON_RELEASE_MAX) {
    return variant.item
  }

  return variant.releasePending
}

export function oathUpgradeSteps(): readonly OathUpgradeStep[] {
  return variantTable.oathUpgradeSteps
}

export function findOathUpgradeOption(step: number, option: string): OathUpgradeOption | null {
  const upgradeStep = variantTable.oathUpgradeSteps.find((candidate) => candidate.step === step)
  const found = upgradeStep?.options.find((candidate) => candidate.option === option)

  if (found === undefined) {
    return null
  }

  return found
}

/** 진의는 1단계부터 빠짐없이 이어져야 하고, 빈 목록은 진의가 없는 상태다. */
export function isValidOathUpgrade(upgrades: readonly OathUpgradeSelection[]): boolean {
  if (upgrades.length > OATH_UPGRADE_MAX_STEP) {
    return false
  }

  return upgrades.every(
    ({ step, option }, index) => step === index + 1 && findOathUpgradeOption(step, option) !== null
  )
}
