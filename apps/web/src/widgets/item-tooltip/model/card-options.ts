import {
  BUFF_PASSIVE_SKILL,
  buffSkillLevel,
  type EnchantRole,
  enchantGroup,
  enchantOrderRank,
  enchantStatGroup,
  isEmphasizedEnchant
} from '#entities/character'
import type { ItemCard } from './item-detail'

const MISSING_STAGE_VALUE = '-'
const ALL_ROLES: readonly EnchantRole[] = ['dealer', 'buffer']

export type CardOptionRow = Readonly<{
  name: string
  values: readonly string[]
  emphasized: boolean
}>

type StageValues = (string | null)[]

function isLarger(value: string, current: string | null): boolean {
  return current === null || Number.parseFloat(value) > Number.parseFloat(current)
}

function groupedStageValues(card: ItemCard): Map<string, StageValues> {
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

function buffSkillValues(card: ItemCard): StageValues | null {
  const levels = card.enchants.map(({ reinforceSkill }) =>
    buffSkillLevel({ status: [], reinforceSkill })
  )

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

export function cardOptionRows(card: ItemCard, role: EnchantRole | undefined): CardOptionRow[] {
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

  return rows.toSorted(byEmphasisAndOrder)
}
