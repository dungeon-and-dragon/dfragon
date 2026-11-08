import { formatStatValue, type ItemRarity } from './character-detail-display'
import type { CharacterDetailView } from './character-detail-view'
import { type ItemView, itemRarityOfGrade, toItemView, tuneNumeral } from './character-item'

type EquipmentItem = CharacterDetailView['equipment']['equipment'][number]
type Enchant = NonNullable<EquipmentItem['enchant']>
type StatValue = number | string

const AURA_SLOT_ID = 'AURORA'
const WEAPON_SLOT_ID = 'WEAPON'
const SUB_WEAPON_SLOT_ID = 'SUPPORT_WEAPON'
const BUFF_PASSIVE_SKILL = '버프 패시브 스킬'
const ALL_ELEMENT = '모든 속성 강화'
const ALL_STAT = '올스탯'
const ATTACK = '공격력'
const CRITICAL = '크리티컬'
const FINAL_DAMAGE = '최종 데미지 증가'
const ATTACK_AMPLIFY = '공격력 증폭'
const SINGLE_ELEMENT_PATTERN = /^[화수명암]속성\s?강화$/
const PLAIN_VALUE_PATTERN = /^(-?\d+(?:\.\d+)?)(%?)$/

// 2026-11-06 저장소 소유자 결정의 마법부여 묶음이다.
const ENCHANT_GROUPS: ReadonlyMap<string, string> = new Map([
  ['힘', ALL_STAT],
  ['지능', ALL_STAT],
  ['체력', ALL_STAT],
  ['정신력', ALL_STAT],
  ['물리 공격력', ATTACK],
  ['마법 공격력', ATTACK],
  ['독립 공격력', ATTACK],
  ['물리 크리티컬 히트', CRITICAL],
  ['마법 크리티컬 히트', CRITICAL]
])

// 2026-11-06 저장소 소유자 결정: 역할마다 중요한 묶음을 앞에 강조하고, 나머지는 이 순서 뒤에 흐리게 둔다.
const ENCHANT_ORDER = [
  FINAL_DAMAGE,
  ATTACK_AMPLIFY,
  ALL_ELEMENT,
  BUFF_PASSIVE_SKILL,
  ATTACK,
  ALL_STAT,
  CRITICAL
]
const EMPHASIZED_ENCHANTS: Readonly<Record<EnchantRole, ReadonlySet<string>>> = {
  dealer: new Set([FINAL_DAMAGE, ATTACK_AMPLIFY, ALL_ELEMENT]),
  buffer: new Set([BUFF_PASSIVE_SKILL, ALL_STAT])
}

export type EnchantRole = 'dealer' | 'buffer'

export type EnchantOption = Readonly<{ label: string; emphasized: boolean }>

export type EquipmentReinforce = Readonly<{ kind: 'amplify' | 'enhance'; value: number }>

export type EquipmentRow = ItemView &
  Readonly<{
    slotName: string | null
    tune: string | null
    exalted: boolean
    reinforce: EquipmentReinforce | null
    refine: number | null
    enchants: EnchantOption[]
    setPoint: number | null
    potency: string | null
  }>

export type EquipmentSet = Readonly<{
  name: string | null
  rarityName: string | null
  rarity: ItemRarity | null
  point: number | null
}>

export type EquipmentView = Readonly<{
  sets: EquipmentSet[]
  mistLevel: number | null
  items: EquipmentRow[]
  creature: ItemView | null
  aura: ItemView | null
}>

function enchantGroup(name: string): string {
  if (SINGLE_ELEMENT_PATTERN.test(name)) {
    return ALL_ELEMENT
  }

  const group = ENCHANT_GROUPS.get(name)

  if (group === undefined) {
    return name
  }

  return group
}

function magnitude(value: StatValue): number {
  if (typeof value === 'number') {
    return value
  }

  return Number.parseFloat(value)
}

function enchantValueText(value: StatValue): string {
  const plain = typeof value === 'string' ? PLAIN_VALUE_PATTERN.exec(value) : null

  if (plain === null) {
    return formatStatValue(value)
  }

  const [, number, unit] = plain

  return `${formatStatValue(Number(number))}${unit}`
}

function signed(value: StatValue): string {
  const text = enchantValueText(value)

  if (text.startsWith('-') || text.startsWith('+')) {
    return text
  }

  return `+${text}`
}

function orderRank(name: string): number {
  const index = ENCHANT_ORDER.indexOf(name)

  if (index === -1) {
    return ENCHANT_ORDER.length
  }

  return index
}

export function groupEnchant(enchant: Enchant | null, role: EnchantRole): EnchantOption[] {
  const groups = new Map<string, StatValue>()

  for (const { name, value } of enchant?.status ?? []) {
    if (name == null || value == null) {
      continue
    }

    const group = enchantGroup(name)
    const current = groups.get(group)

    if (current === undefined || magnitude(value) > magnitude(current)) {
      groups.set(group, value)
    }
  }

  const skillLevels = (enchant?.reinforceSkill ?? []).flatMap(({ skills }) =>
    skills.flatMap(({ value }) => (value != null ? [value] : []))
  )

  if (skillLevels.length > 0) {
    groups.set(BUFF_PASSIVE_SKILL, Math.max(...skillLevels))
  }

  const emphasized = EMPHASIZED_ENCHANTS[role]
  const options = [...groups].map(([name, value]) => ({
    name,
    label: `${name} ${signed(value)}`,
    emphasized: emphasized.has(name)
  }))
  const sorted = options.toSorted((a, b) => {
    const emphasisOrder = Number(b.emphasized) - Number(a.emphasized)

    if (emphasisOrder !== 0) {
      return emphasisOrder
    }

    return orderRank(a.name) - orderRank(b.name)
  })

  return sorted.map(({ label, emphasized }) => ({ label, emphasized }))
}

function enchantRole(card: CharacterDetailView['card']): EnchantRole {
  if (card?.role === 'buffer') {
    return 'buffer'
  }

  return 'dealer'
}

function toReinforce(item: EquipmentItem): EquipmentReinforce | null {
  if (item.reinforce == null || item.reinforce <= 0) {
    return null
  }

  const kind = item.amplificationName != null ? 'amplify' : 'enhance'

  return { kind, value: item.reinforce }
}

function formatPotency(value: StatValue | null): string | null {
  if (value == null) {
    return null
  }

  const text = String(value)

  if (text.endsWith('%')) {
    return text
  }

  return `${text}%`
}

function highestTune(item: EquipmentItem): string | null {
  const levels = item.tune.flatMap(({ level }) => (level != null ? [level] : []))

  if (levels.length === 0) {
    return null
  }

  return tuneNumeral(Math.max(...levels))
}

function toEquipmentRow(item: EquipmentItem, role: EnchantRole): EquipmentRow {
  const refined = item.refine != null && item.refine > 0
  const refine = refined ? item.refine : null
  const setPoint = item.tune.find((tune) => tune.setPoint != null)?.setPoint ?? null
  const potency = formatPotency(item.potency?.value ?? null)

  return {
    ...toItemView(item),
    slotName: item.slotName,
    tune: highestTune(item),
    exalted: item.exaltedInfo != null,
    reinforce: toReinforce(item),
    refine,
    enchants: groupEnchant(item.enchant, role),
    setPoint,
    potency
  }
}

// 응답은 보조무기를 마법석 뒤에 두지만, 화면에서는 무기와 함께 보도록 무기 바로 아래로 옮긴다.
function subWeaponAfterWeapon(items: EquipmentItem[]): EquipmentItem[] {
  const subWeapon = items.find(({ slotId }) => slotId === SUB_WEAPON_SLOT_ID)
  const hasWeapon = items.some(({ slotId }) => slotId === WEAPON_SLOT_ID)

  if (subWeapon === undefined || !hasWeapon) {
    return items
  }

  return items.flatMap((item) => {
    if (item === subWeapon) {
      return []
    }

    if (item.slotId === WEAPON_SLOT_ID) {
      return [item, subWeapon]
    }

    return [item]
  })
}

export function toEquipmentView(
  detail: Pick<
    CharacterDetailView,
    'equipment' | 'creature' | 'avatar' | 'mistAssimilation' | 'card'
  >
): EquipmentView {
  const role = enchantRole(detail.card)
  const creature = detail.creature != null ? toItemView(detail.creature) : null
  const mistLevel = detail.mistAssimilation?.level ?? null
  const auraAvatar = detail.avatar.find(({ slotId }) => slotId === AURA_SLOT_ID)
  const aura = auraAvatar !== undefined ? toItemView(auraAvatar) : null

  return {
    sets: detail.equipment.setItemInfo.map((set) => {
      const point = set.active?.setPoint?.current ?? null

      return {
        name: set.setItemName,
        rarityName: set.setItemRarityName,
        rarity: itemRarityOfGrade(set.setItemRarityName),
        point
      }
    }),
    mistLevel,
    items: subWeaponAfterWeapon(detail.equipment.equipment).map((item) =>
      toEquipmentRow(item, role)
    ),
    creature,
    aura
  }
}
