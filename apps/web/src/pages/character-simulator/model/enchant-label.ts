import { displayStatusOf, type EnchantDisplayStatus } from '@dfragon/lib/enchant-grades'
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

// 응답은 단일 속성 강화를 붙여 쓰지만("화속성강화") 화면은 다른 옵션 이름처럼 띄어 쓴다.
const SINGLE_ELEMENT_NAME = /^([화수명암])속성\s?강화$/

function displayName(name: string): string {
  return name.replace(SINGLE_ELEMENT_NAME, '$1속성 강화')
}

/**
 * 묶음 표시 규칙은 API의 선택지와 같은 lib의 규칙을 쓰고, 여기서는 이름 띄어쓰기, 부호, 스킬 레벨 줄과 역할별 강조, 순서만
 * 정한다. 강조와 순서는 캐릭터 상세 장비 탭과 같은 규칙이다.
 */
function labelsOf(
  display: readonly EnchantDisplayStatus[],
  skillLevel: number | null,
  role: EnchantRole
): EnchantOption[] {
  const skill = skillLevel !== null ? [{ name: BUFF_PASSIVE_SKILL, value: skillLevel }] : []
  const options = [...display, ...skill].map(({ name, value }, order) => {
    const group = enchantGroup(name)
    const emphasized = isEmphasizedEnchant(group, role)
    const shownName = displayName(name)

    return { name: shownName, value, order, group, emphasized }
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

export function optionEnchantLabels(
  { display, skillLevel }: { display: readonly EnchantDisplayStatus[]; skillLevel: number | null },
  role: EnchantRole
): EnchantOption[] {
  return labelsOf(display, skillLevel, role)
}

export function equippedEnchantLabels(
  enchant: EnchantStats | null,
  role: EnchantRole
): EnchantOption[] {
  const status = (enchant?.status ?? []).flatMap(({ name, value }) => {
    if (name == null || value == null) {
      return []
    }

    return [{ name, value }]
  })

  return labelsOf(displayStatusOf({ status }), buffSkillLevel(enchant), role)
}
