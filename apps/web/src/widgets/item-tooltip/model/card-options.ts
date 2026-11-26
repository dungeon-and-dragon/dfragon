import {
  BUFF_PASSIVE_SKILL,
  buffSkillLevel,
  type EnchantRole,
  enchantGroup,
  enchantOrderRank,
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

function optionNames(card: ItemCard): string[] {
  const names = card.enchants.flatMap(({ status }) => status.map(({ name }) => name))

  return [...new Set(names)]
}

function stageValue(status: ItemCard['enchants'][number]['status'], name: string): string {
  const option = status.find((candidate) => candidate.name === name)

  if (option === undefined) {
    return MISSING_STAGE_VALUE
  }

  return option.value
}

function rolesOf(role: EnchantRole | undefined): readonly EnchantRole[] {
  if (role === undefined) {
    return ALL_ROLES
  }

  return [role]
}

function isEmphasized(group: string, roles: readonly EnchantRole[]): boolean {
  return roles.some((role) => isEmphasizedEnchant(group, role))
}

function levelText(level: number | null): string {
  if (level === null) {
    return MISSING_STAGE_VALUE
  }

  return String(level)
}

// 캐릭터 상세 장비 탭처럼 직업별 버프 스킬을 단계마다 가장 큰 값 하나로 묶는다.
function buffSkillRow(card: ItemCard, roles: readonly EnchantRole[]): CardOptionRow | null {
  const levels = card.enchants.map(({ reinforceSkill }) =>
    buffSkillLevel({ status: [], reinforceSkill })
  )

  if (levels.every((level) => level === null)) {
    return null
  }

  const values = levels.map(levelText)
  const emphasized = isEmphasized(BUFF_PASSIVE_SKILL, roles)

  return { name: BUFF_PASSIVE_SKILL, values, emphasized }
}

// 버프 스킬 줄만 장비 탭의 옵션 순서로 끼워 넣고, 나머지 줄은 가장 낮은 단계의 옵션 순서를 지킨다.
function withBuffSkillRow(rows: CardOptionRow[], buffRow: CardOptionRow | null): CardOptionRow[] {
  if (buffRow === null) {
    return rows
  }

  const buffRank = enchantOrderRank(BUFF_PASSIVE_SKILL)
  const index = rows.findIndex(({ name }) => enchantOrderRank(enchantGroup(name)) > buffRank)

  if (index === -1) {
    return [...rows, buffRow]
  }

  return [...rows.slice(0, index), buffRow, ...rows.slice(index)]
}

export function cardOptionRows(card: ItemCard, role: EnchantRole | undefined): CardOptionRow[] {
  const roles = rolesOf(role)
  const rows = optionNames(card).map((name) => {
    const values = card.enchants.map(({ status }) => stageValue(status, name))
    const emphasized = isEmphasized(enchantGroup(name), roles)

    return { name, values, emphasized }
  })

  const buffRow = buffSkillRow(card, roles)

  return withBuffSkillRow(rows, buffRow)
}
