import table from './enchant-grades.json' with { type: 'json' }

export const ENCHANT_GRADE_SLOTS = [
  'WEAPON',
  'JACKET',
  'SHOULDER',
  'PANTS',
  'WAIST',
  'SHOES',
  'AMULET',
  'WRIST',
  'RING',
  'SUPPORT',
  'MAGIC_STON',
  'EARRING'
] as const

export type EnchantGradeSlot = (typeof ENCHANT_GRADE_SLOTS)[number]

export type EnchantGradeRole = 'dealer' | 'buffer'

export type EnchantGradeTier = '종결' | '준종결'

export interface EnchantStatus {
  readonly name: string
  readonly value: number | string
}

export interface EnchantSkill {
  readonly name: string
  readonly value: number | string
}

export interface EnchantReinforceSkill {
  readonly jobName: string
  readonly skills: readonly EnchantSkill[]
}

export interface EnchantGrade {
  readonly id: string
  readonly status: readonly EnchantStatus[]
  readonly reinforceSkill: readonly EnchantReinforceSkill[]
  readonly fame: number
  readonly cardName: string
  readonly cardId: number
  readonly roles: readonly EnchantGradeRole[]
}

export type EnchantGradeTiers = Readonly<Record<EnchantGradeTier, readonly EnchantGrade[]>>

interface EnchantGradeTable {
  readonly version: 2
  readonly slots: Readonly<Record<EnchantGradeSlot, EnchantGradeTiers>>
}

// 엔진 저장소가 만든 파일을 그대로 두므로 모양은 테스트가 확인한다.
const grades = table as EnchantGradeTable

export function enchantGradesOf(
  slotId: EnchantGradeSlot,
  role: EnchantGradeRole
): EnchantGradeTiers {
  const tiers = grades.slots[slotId]
  const fits = (grade: EnchantGrade) => grade.roles.includes(role)
  const finals = tiers.종결.filter(fits)
  const semiFinals = tiers.준종결.filter(fits)

  return { 종결: finals, 준종결: semiFinals }
}

export function findEnchantGrade(slotId: EnchantGradeSlot, id: string): EnchantGrade | null {
  const tiers = grades.slots[slotId]
  const grade = [...tiers.종결, ...tiers.준종결].find((candidate) => candidate.id === id)

  if (grade === undefined) {
    return null
  }

  return grade
}
