import {
  BUFF_PASSIVE_SKILL,
  buffSkillLevel,
  type EnchantOption,
  type EnchantRole,
  type EnchantStats,
  enchantGroup,
  enchantOrderRank,
  isEmphasizedEnchant,
  signedEnchantValue
} from '#entities/character'

type StatValue = number | string

type LabeledStat = Readonly<{ name: string; value: StatValue; order: number }>

// 묶음의 이름이 모두 같은 값으로 있을 때만 한 이름으로 줄인다(2026-11-23 저장소 소유자 결정).
const SHORTHANDS: readonly Readonly<{ name: string; members: readonly string[] }>[] = [
  { name: '올스탯', members: ['힘', '지능', '체력', '정신력'] },
  { name: '공격력', members: ['물리 공격력', '마법 공격력', '독립 공격력'] },
  { name: '크리티컬', members: ['물리 크리티컬 히트', '마법 크리티컬 히트'] }
]

// 응답은 단일 속성 강화를 붙여 쓰지만("화속성강화") 화면은 다른 옵션 이름처럼 띄어 쓴다.
const SINGLE_ELEMENT_NAME = /^([화수명암])속성\s?강화$/

function displayName(name: string): string {
  return name.replace(SINGLE_ELEMENT_NAME, '$1속성 강화')
}

function presentStats(enchant: EnchantStats | null): LabeledStat[] {
  return (enchant?.status ?? []).flatMap(({ name, value }, order) => {
    if (name == null || value == null) {
      return []
    }

    return [{ name: displayName(name), value, order }]
  })
}

function shortenStats(stats: readonly LabeledStat[]): LabeledStat[] {
  return SHORTHANDS.reduce<LabeledStat[]>(
    (remaining, { name, members }) => {
      const included = remaining.filter((stat) => members.includes(stat.name))
      const values = new Set(included.map(({ value }) => signedEnchantValue(value)))
      const coversAll = members.every((member) => included.some((stat) => stat.name === member))
      const [first] = included

      if (!coversAll || values.size !== 1 || first === undefined) {
        return remaining
      }

      const others = remaining.filter((stat) => !included.includes(stat))

      return [...others, { name, value: first.value, order: first.order }]
    },
    [...stats]
  )
}

/**
 * 시뮬레이터의 마법부여 목록, 지금 마법부여, 고른 값에 쓰는 표기다. 캐릭터 상세 장비 탭의 묶음 표기와 달리 옵션 이름을
 * 그대로 두고, 같은 값으로 모두 있는 묶음만 줄인다. 강조와 순서는 장비 탭과 같은 역할별 규칙이다.
 */
export function enchantLabels(enchant: EnchantStats | null, role: EnchantRole): EnchantOption[] {
  const stats = shortenStats(presentStats(enchant))
  const skillLevel = buffSkillLevel(enchant)
  const skill =
    skillLevel !== null
      ? [{ name: BUFF_PASSIVE_SKILL, value: skillLevel, order: Number.POSITIVE_INFINITY }]
      : []

  const options = [...stats, ...skill].map((stat) => {
    const group = enchantGroup(stat.name)
    const emphasized = isEmphasizedEnchant(group, role)

    return { ...stat, group, emphasized }
  })

  const sorted = options.toSorted((a, b) => {
    const emphasisOrder = Number(b.emphasized) - Number(a.emphasized)
    const groupOrder = enchantOrderRank(a.group) - enchantOrderRank(b.group)

    if (emphasisOrder !== 0) {
      return emphasisOrder
    }

    if (groupOrder !== 0) {
      return groupOrder
    }

    return a.order - b.order
  })

  return sorted.map(({ name, value, emphasized }) => {
    const label = `${name} ${signedEnchantValue(value)}`

    return { label, emphasized }
  })
}
