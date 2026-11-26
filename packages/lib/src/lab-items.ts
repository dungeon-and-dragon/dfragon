import {
  ENCHANT_GRADE_SLOTS,
  type EnchantGradeRole,
  type EnchantGradeSlot,
  type EnchantGradeTier
} from './enchant-grades.js'

export const LAB_ITEM_CATEGORIES = [...ENCHANT_GRADE_SLOTS, 'TITLE', 'CREATURE', 'AURA'] as const

export type LabItemCategory = (typeof LAB_ITEM_CATEGORIES)[number]

export const LAB_ITEM_ROLES = ['dealer', 'buffer', 'all'] as const

export type LabItemRole = (typeof LAB_ITEM_ROLES)[number]

export const LAB_ITEM_TIERS = ['종결', '준종결'] as const satisfies readonly EnchantGradeTier[]

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
