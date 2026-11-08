import type { UpgradeType } from '#core/shared/search/skill-window'

export const EVOLUTION_NUMERALS: Readonly<Record<UpgradeType, string>> = { 1: 'Ⅰ', 2: 'Ⅱ' }
export const ENHANCEMENT_LABELS: Readonly<Record<UpgradeType, string>> = {
  1: '데미지',
  2: '쿨타임 감소'
}
