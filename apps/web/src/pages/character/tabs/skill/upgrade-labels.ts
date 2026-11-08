import type { UpgradeType } from '#core/catalog/skill-window'

export const EVOLUTION_NUMERALS: Readonly<Record<UpgradeType, string>> = { 1: 'Ⅰ', 2: 'Ⅱ' }
export const ENHANCEMENT_LABELS: Readonly<Record<UpgradeType, string>> = {
  1: '데미지',
  2: '쿨타임 감소'
}
