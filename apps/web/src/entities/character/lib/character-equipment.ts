import {
  BUFF_PASSIVE_SKILL,
  buffSkillLevel,
  type EnchantRole,
  enchantGroup,
  enchantOrderRank,
  isEmphasizedEnchant
} from '@dfragon/lib/enchant-options'
import { formatStatValue, type ItemRarity } from './character-detail-display'
import type { CharacterDetailView } from '#entities/character/model/character-detail-view'
import { type ItemView, itemRarityOfGrade, toItemView, tuneNumeral } from './character-item'

type EquipmentItem = CharacterDetailView['equipment']['equipment'][number]
type SetItem = CharacterDetailView['equipment']['setItemInfo'][number]
type StatValue = number | string

export type EnchantStats = Readonly<{
  status: readonly Readonly<{ name: string | null; value: StatValue | null }>[]
  reinforceSkill: readonly Readonly<{ skills: readonly Readonly<{ value: StatValue | null }>[] }>[]
}>

const AURA_SLOT_ID = 'AURORA'
const WEAPON_SLOT_ID = 'WEAPON'
const SUB_WEAPON_SLOT_ID = 'SUPPORT_WEAPON'
const PLAIN_VALUE_PATTERN = /^(-?\d+(?:\.\d+)?)(%?)$/

export type EnchantOption = Readonly<{ label: string; emphasized: boolean }>

export type EquipmentReinforce = Readonly<{ kind: 'amplify' | 'enhance'; value: number }>

export type EquipmentRow = ItemView &
  Readonly<{
    slotName: string | null
    tune: string | null
    reinforce: EquipmentReinforce | null
    refine: number | null
    enchants: EnchantOption[]
    potency: string | null
  }>

export type EquipmentSet = Readonly<{
  name: string | null
  rarityName: string | null
  rarity: ItemRarity | null
  point: number | null
}>

export type EquipmentView = Readonly<{
  set: EquipmentSet | null
  mistLevel: number | null
  items: EquipmentRow[]
  creature: ItemView | null
  aura: ItemView | null
}>

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

export function signedEnchantValue(value: StatValue): string {
  const text = enchantValueText(value)

  if (text.startsWith('-') || text.startsWith('+')) {
    return text
  }

  return `+${text}`
}

export function groupEnchant(enchant: EnchantStats | null, role: EnchantRole): EnchantOption[] {
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

  const skillLevel = buffSkillLevel(enchant)

  if (skillLevel !== null) {
    groups.set(BUFF_PASSIVE_SKILL, skillLevel)
  }

  const options = [...groups].map(([name, value]) => ({
    name,
    label: `${name} ${signedEnchantValue(value)}`,
    emphasized: isEmphasizedEnchant(name, role)
  }))
  const sorted = options.toSorted((a, b) => {
    const emphasisOrder = Number(b.emphasized) - Number(a.emphasized)

    if (emphasisOrder !== 0) {
      return emphasisOrder
    }

    return enchantOrderRank(a.name) - enchantOrderRank(b.name)
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

// 응답의 정밀도 값 끝에 붙어 올 수 있는 퍼센트 기호다.
const POTENCY_PERCENT_SUFFIX = /%$/

function formatPotency(value: StatValue | null): string | null {
  if (value == null) {
    return null
  }

  const text = String(value).replace(POTENCY_PERCENT_SUFFIX, '')

  // 정밀도가 다 찬 100%는 보이지 않는다(2026-11-21 저장소 소유자 결정).
  if (Number(text) === 100) {
    return null
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
  const potency = formatPotency(item.potency?.value ?? null)

  return {
    ...toItemView(item),
    slotName: item.slotName,
    tune: highestTune(item),
    reinforce: toReinforce(item),
    refine,
    enchants: groupEnchant(item.enchant, role),
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

function hasMorePoint(set: EquipmentSet, than: EquipmentSet): boolean {
  if (set.point === null) {
    return false
  }

  if (than.point === null) {
    return true
  }

  return set.point > than.point
}

function toEquipmentSet(set: SetItem): EquipmentSet {
  const point = set.active?.setPoint?.current ?? null

  return {
    name: set.setItemName,
    rarityName: set.setItemRarityName,
    rarity: itemRarityOfGrade(set.setItemRarityName),
    point
  }
}

// Neople이 세트를 둘 이상 줄 때가 있어 세트 포인트가 가장 큰 세트 하나만 보이고, 같은 포인트면 앞 세트를 쓴다.
function toMainEquipmentSet(setItemInfo: readonly SetItem[]): EquipmentSet | null {
  const [first, ...rest] = setItemInfo.map(toEquipmentSet)

  if (first === undefined) {
    return null
  }

  return rest.reduce((main, set) => {
    if (hasMorePoint(set, main)) {
      return set
    }

    return main
  }, first)
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
  const set = toMainEquipmentSet(detail.equipment.setItemInfo)

  return {
    set,
    mistLevel,
    items: subWeaponAfterWeapon(detail.equipment.equipment).map((item) =>
      toEquipmentRow(item, role)
    ),
    creature,
    aura
  }
}
