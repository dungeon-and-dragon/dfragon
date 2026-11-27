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

export interface EnchantStatus {
  readonly name: string
  readonly value: number | string
}

interface EnchantSkill {
  readonly name: string
  readonly value: number | string
}

export interface EnchantReinforceSkill {
  readonly jobName: string
  readonly skills: readonly EnchantSkill[]
}

export interface EnchantEntry {
  readonly status: readonly EnchantStatus[]
  readonly reinforceSkill: readonly EnchantReinforceSkill[]
}

export const ENCHANT_MAIN_STATS = ['힘', '지능', '체력', '정신력'] as const

export type EnchantMainStat = (typeof ENCHANT_MAIN_STATS)[number]

export function isEnchantMainStat(value: unknown): value is EnchantMainStat {
  return (ENCHANT_MAIN_STATS as readonly unknown[]).includes(value)
}

export interface EnchantDisplayStatus {
  readonly name: string
  readonly value: number | string
}

/** 표시가 같은 항목의 묶음이다. key는 표시와 직업별 스킬 강화가 같으면 같은 문자열이다. */
export interface EnchantEntryGroup<T extends EnchantEntry> {
  readonly key: string
  readonly display: readonly EnchantDisplayStatus[]
  readonly members: readonly T[]
}

const MAIN_STATS: readonly string[] = ENCHANT_MAIN_STATS
const ATTACK_STATS: readonly string[] = ['물리 공격력', '마법 공격력', '독립 공격력']
const CRITICAL_STATS: readonly string[] = ['물리 크리티컬 히트', '마법 크리티컬 히트']

interface StatAmount {
  readonly amount: number
  readonly unit: string
}

// 같은 수치가 "3%"와 "3.0%"처럼 다르게 적혀도 같은 값으로 본다.
function amountOf(value: number | string): StatAmount {
  if (typeof value === 'number') {
    return { amount: value, unit: '' }
  }

  const unit = value.endsWith('%') ? '%' : ''
  const digits = unit === '' ? value : value.slice(0, -1)
  const amount = Number(digits)

  return { amount, unit }
}

function displayValue({ amount, unit }: StatAmount): number | string {
  if (unit === '') {
    return amount
  }

  return `${amount}${unit}`
}

function maxAmount(statuses: readonly EnchantStatus[]): StatAmount {
  const amounts = statuses.map((status) => amountOf(status.value))

  return amounts.reduce((max, current) => {
    if (current.amount > max.amount) {
      return current
    }

    return max
  })
}

// 원본 마법부여의 칸 순서를 따라, 한 묶음으로 표시하는 스탯은 처음 나온 자리에 둔다.
// 웹이 착용한 마법부여도 선택지와 같은 표기로 보이도록 status만 받는다.
export function displayStatusOf(grade: Pick<EnchantEntry, 'status'>): EnchantDisplayStatus[] {
  const display: EnchantDisplayStatus[] = []
  const pick = (names: readonly string[]) =>
    grade.status.filter((status) => names.includes(status.name))

  const mainStats = pick(MAIN_STATS)
  const attacks = pick(ATTACK_STATS)
  const criticals = pick(CRITICAL_STATS)
  const attackAmounts = attacks.map((status) => amountOf(status.value))
  const sameAttack =
    attacks.length === ATTACK_STATS.length &&
    attackAmounts.every(
      ({ amount, unit }) => amount === attackAmounts[0]!.amount && unit === attackAmounts[0]!.unit
    )

  for (const status of grade.status) {
    if (MAIN_STATS.includes(status.name)) {
      if (status === mainStats[0]) {
        const value = displayValue(maxAmount(mainStats))
        display.push({ name: '올스탯', value })
      }
    } else if (ATTACK_STATS.includes(status.name) && sameAttack) {
      if (status === attacks[0]) {
        const value = displayValue(attackAmounts[0]!)
        display.push({ name: '공격력', value })
      }
    } else if (CRITICAL_STATS.includes(status.name)) {
      if (status === criticals[0]) {
        const value = displayValue(maxAmount(criticals))
        display.push({ name: '크리티컬', value })
      }
    } else {
      const value = displayValue(amountOf(status.value))
      display.push({ name: status.name, value })
    }
  }

  return display
}

function optionKey(display: readonly EnchantDisplayStatus[], entry: EnchantEntry): string {
  const skills = entry.reinforceSkill.map((job) => {
    const jobSkills = job.skills.map(({ name, value }) => {
      const { amount } = amountOf(value)

      return { name, value: amount }
    })

    return { jobName: job.jobName, skills: jobSkills }
  })

  // 항목마다 칸 순서가 달라도 같은 표시면 같은 묶음이 되게 이름순으로 비교한다.
  const sorted = [...display].sort((left, right) => left.name.localeCompare(right.name))

  return JSON.stringify([sorted, skills])
}

/** 처음 나온 순서대로 묶고, 묶음 안의 항목도 받은 순서를 지킨다. */
export function groupEnchantEntries<T extends EnchantEntry>(
  entries: readonly T[]
): EnchantEntryGroup<T>[] {
  const groups = new Map<string, { key: string; display: EnchantDisplayStatus[]; members: T[] }>()

  for (const entry of entries) {
    const display = displayStatusOf(entry)
    const key = optionKey(display, entry)
    const group = groups.get(key)

    if (group === undefined) {
      groups.set(key, { key, display, members: [entry] })
    } else {
      group.members.push(entry)
    }
  }

  return [...groups.values()]
}

function hasAllMainStats(entry: EnchantEntry): boolean {
  return MAIN_STATS.every((name) => entry.status.some((status) => status.name === name))
}

export interface EnchantMembers<T extends EnchantEntry> {
  readonly members: readonly T[]
}

/** 네 주스탯을 모두 올리는 항목이 없는 여러 항목 묶음만 캐릭터의 주스탯으로 고른다. */
export function optionNeedsMainStat(option: EnchantMembers<EnchantEntry>): boolean {
  return option.members.length > 1 && !option.members.some(hasAllMainStats)
}

/** 네 주스탯을 모두 올리는 항목, 주스탯을 올리는 항목, 첫 항목 순으로 고른다. */
export function chooseEnchantGrade<T extends EnchantEntry>(
  option: EnchantMembers<T>,
  mainStat: EnchantMainStat | null
): T {
  const allStats = option.members.find(hasAllMainStats)

  if (allStats !== undefined) {
    return allStats
  }

  const matching = option.members.find((member) =>
    member.status.some((status) => status.name === mainStat)
  )

  if (matching !== undefined) {
    return matching
  }

  return option.members[0]!
}
