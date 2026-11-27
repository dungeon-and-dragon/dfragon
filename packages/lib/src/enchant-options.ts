type StatValue = number | string

export type EnchantRole = 'dealer' | 'buffer'

export type EnchantSkillLevels = Readonly<{
  reinforceSkill: readonly Readonly<{ skills: readonly Readonly<{ value: StatValue | null }>[] }>[]
}>

export type EnchantCardStage = Readonly<{
  status: readonly Readonly<{ name: string; value: string }>[]
  reinforceSkill: readonly Readonly<{ skills: readonly Readonly<{ value: string }>[] }>[]
}>

export type EnchantCard = Readonly<{ enchants: readonly EnchantCardStage[] }>

export type CardOptionRow = Readonly<{
  name: string
  values: readonly string[]
  emphasized: boolean
}>

export const BUFF_PASSIVE_SKILL = '버프 패시브 스킬'
const ALL_ELEMENT = '모든 속성 강화'
const ALL_STAT = '올스탯'
const ATTACK = '공격력'
const CRITICAL = '크리티컬'
const FINAL_DAMAGE = '최종 데미지 증가'
const ATTACK_AMPLIFY = '공격력 증폭'
const SINGLE_ELEMENT_PATTERN = /^[화수명암]속성\s?강화$/
const MISSING_STAGE_VALUE = '-'
const ALL_ROLES: readonly EnchantRole[] = ['dealer', 'buffer']

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

// 단일 속성 강화는 그대로 두고 올스탯, 공격력, 크리티컬 묶음만 적용한다.
export function enchantStatGroup(name: string): string {
  const group = ENCHANT_GROUPS.get(name)

  if (group === undefined) {
    return name
  }

  return group
}

export function enchantGroup(name: string): string {
  if (SINGLE_ELEMENT_PATTERN.test(name)) {
    return ALL_ELEMENT
  }

  return enchantStatGroup(name)
}

function magnitude(value: StatValue): number {
  if (typeof value === 'number') {
    return value
  }

  return Number.parseFloat(value)
}

export function enchantOrderRank(name: string): number {
  const index = ENCHANT_ORDER.indexOf(name)

  if (index === -1) {
    return ENCHANT_ORDER.length
  }

  return index
}

export function isEmphasizedEnchant(group: string, role: EnchantRole): boolean {
  return EMPHASIZED_ENCHANTS[role].has(group)
}

export function buffSkillLevel(enchant: EnchantSkillLevels | null): number | null {
  const skillLevels = (enchant?.reinforceSkill ?? []).flatMap(({ skills }) =>
    skills.flatMap(({ value }) => (value != null ? [magnitude(value)] : []))
  )

  if (skillLevels.length === 0) {
    return null
  }

  return Math.max(...skillLevels)
}

type StageValues = (string | null)[]

function isLarger(value: string, current: string | null): boolean {
  return current === null || Number.parseFloat(value) > Number.parseFloat(current)
}

function groupedStageValues(card: EnchantCard): Map<string, StageValues> {
  const groups = new Map<string, StageValues>()

  card.enchants.forEach(({ status }, stage) => {
    for (const { name, value } of status) {
      const group = enchantStatGroup(name)
      const values = groups.get(group) ?? card.enchants.map(() => null)

      if (isLarger(value, values[stage] ?? null)) {
        values[stage] = value
      }

      groups.set(group, values)
    }
  })

  return groups
}

function rolesOf(role: EnchantRole | undefined): readonly EnchantRole[] {
  if (role === undefined) {
    return ALL_ROLES
  }

  return [role]
}

// 단일 속성 강화는 이름을 그대로 보이되, 강조와 순서는 장비 탭처럼 모든 속성 강화로 따진다.
function isEmphasized(name: string, roles: readonly EnchantRole[]): boolean {
  return roles.some((role) => isEmphasizedEnchant(enchantGroup(name), role))
}

function levelText(level: number | null): string {
  if (level === null) {
    return MISSING_STAGE_VALUE
  }

  return String(level)
}

function buffSkillValues(card: EnchantCard): StageValues | null {
  const levels = card.enchants.map(({ reinforceSkill }) => buffSkillLevel({ reinforceSkill }))

  if (levels.every((level) => level === null)) {
    return null
  }

  return levels.map(levelText)
}

function byEmphasisAndOrder(a: CardOptionRow, b: CardOptionRow): number {
  const emphasisOrder = Number(b.emphasized) - Number(a.emphasized)

  if (emphasisOrder !== 0) {
    return emphasisOrder
  }

  return enchantOrderRank(enchantGroup(a.name)) - enchantOrderRank(enchantGroup(b.name))
}

export function cardOptionRows(card: EnchantCard, role: EnchantRole | undefined): CardOptionRow[] {
  const roles = rolesOf(role)
  const groups = groupedStageValues(card)
  const buffValues = buffSkillValues(card)

  if (buffValues !== null) {
    groups.set(BUFF_PASSIVE_SKILL, buffValues)
  }

  const rows = [...groups].map(([name, stageValues]) => {
    const values = stageValues.map((value) => value ?? MISSING_STAGE_VALUE)
    const emphasized = isEmphasized(name, roles)

    return { name, values, emphasized }
  })

  return rows.sort(byEmphasisAndOrder)
}
