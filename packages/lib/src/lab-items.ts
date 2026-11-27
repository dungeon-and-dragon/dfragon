import {
  ENCHANT_GRADE_SLOTS,
  type EnchantGradeRole,
  type EnchantGradeSlot
} from './enchant-grades.js'

export const LAB_ITEM_CATEGORIES = [...ENCHANT_GRADE_SLOTS, 'TITLE', 'CREATURE', 'AURA'] as const

export type LabItemCategory = (typeof LAB_ITEM_CATEGORIES)[number]

export const LAB_ITEM_ROLES = ['dealer', 'buffer', 'all'] as const

export type LabItemRole = (typeof LAB_ITEM_ROLES)[number]

export const LAB_ITEM_TIERS = ['종결', '준종결', '배럭'] as const

export type LabItemTier = (typeof LAB_ITEM_TIERS)[number]

export interface LabItemGroupKey {
  readonly category: LabItemCategory
  readonly role: LabItemRole
  readonly tier: LabItemTier
}

const ENCHANT_ROLES: readonly EnchantGradeRole[] = ['dealer', 'buffer']
const OTHER_ROLES: readonly LabItemRole[] = ['all']
const ENCHANT_SLOTS: readonly string[] = ENCHANT_GRADE_SLOTS

export function isEnchantCategory(category: LabItemCategory): category is EnchantGradeSlot {
  return ENCHANT_SLOTS.includes(category)
}

export function labItemRolesOf(category: LabItemCategory): readonly LabItemRole[] {
  if (isEnchantCategory(category)) {
    return ENCHANT_ROLES
  }

  return OTHER_ROLES
}

// 웹이 이름과 아이콘 테두리에 칠하는 게임 아이템 등급과 같은 목록이다.
export const LAB_ITEM_RARITIES = [
  '커먼',
  '언커먼',
  '레어',
  '유니크',
  '레전더리',
  '에픽',
  '크로니클',
  '태초',
  '신화'
] as const

export type LabItemRarity = (typeof LAB_ITEM_RARITIES)[number]

const LEVEL_TAG_PATTERN = /\[\d+Lv\]/g
const PLATINUM_PATTERN = / 플래티넘/g
const WHITESPACE_RUN_PATTERN = /\s+/g

// 칭호, 크리쳐는 같은 아이템이 플래티넘과 레벨 꼬리표만 다른 이름으로 여러 개 있어, 둘을 뗀 이름으로 묶는다.
export function labItemBaseName(itemName: string): string {
  return itemName
    .replace(LEVEL_TAG_PATTERN, ' ')
    .replace(PLATINUM_PATTERN, ' ')
    .replace(WHITESPACE_RUN_PATTERN, ' ')
    .trim()
}

// 오라와 마법부여 카드에는 플래티넘, 레벨 변형이 없어 칭호, 크리쳐만 기본 이름으로 묶는다.
export const LAB_ITEM_VARIANT_GROUPED_CATEGORIES = [
  'TITLE',
  'CREATURE'
] as const satisfies readonly LabItemCategory[]

const VARIANT_GROUPED_CATEGORIES: readonly string[] = LAB_ITEM_VARIANT_GROUPED_CATEGORIES

export function isLabItemVariantGrouped(category: string): boolean {
  return VARIANT_GROUPED_CATEGORIES.includes(category)
}

// 묶는 종류는 예전에 변형 이름으로 저장한 아이템도 기본 이름과 같은 아이템으로 본다.
export function isSameLabItem(category: string, savedName: string, itemName: string): boolean {
  if (savedName === itemName) {
    return true
  }

  return isLabItemVariantGrouped(category) && labItemBaseName(savedName) === itemName
}
