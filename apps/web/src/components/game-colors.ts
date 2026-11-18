import type { ItemRarity } from '#core/character'

type RarityKey = ItemRarity | 'unknown'

export const rarityGradientFills = {
  primordial: 'bg-(image:--gradient-rarity-primordial)',
  mythic: 'bg-(image:--gradient-rarity-mythic)'
} as const

const GRADIENT_TEXT = 'bg-clip-text text-transparent'

// 테두리와 배지처럼 그라데이션을 쓸 수 없는 좁은 자리의 단색이다.
export const raritySolidClasses: Readonly<Record<RarityKey, string>> = {
  common: 'text-rarity-common',
  uncommon: 'text-rarity-uncommon',
  rare: 'text-rarity-rare',
  unique: 'text-rarity-unique',
  legendary: 'text-rarity-legendary',
  epic: 'text-rarity-epic',
  chronicle: 'text-rarity-chronicle',
  primordial: 'text-rarity-primordial',
  mythic: 'text-rarity-mythic',
  unknown: 'text-line-strong'
}

export const rarityTextClasses: Readonly<Record<RarityKey, string>> = {
  ...raritySolidClasses,
  primordial: `${rarityGradientFills.primordial} ${GRADIENT_TEXT}`,
  mythic: `${rarityGradientFills.mythic} ${GRADIENT_TEXT}`,
  unknown: 'text-fg'
}

export function raritySolidOf(rarity: ItemRarity | null): string {
  return raritySolidClasses[rarity ?? 'unknown']
}

const RARITY_BY_KOREAN_NAME: Readonly<Record<string, ItemRarity>> = {
  커먼: 'common',
  언커먼: 'uncommon',
  레어: 'rare',
  유니크: 'unique',
  에픽: 'epic',
  레전더리: 'legendary',
  크로니클: 'chronicle',
  태초: 'primordial',
  신화: 'mythic'
}

export function rarityTextOfName(name: string): string | undefined {
  const rarity = RARITY_BY_KOREAN_NAME[name]

  if (rarity === undefined) {
    return undefined
  }

  return rarityTextClasses[rarity]
}

export function raritySolidOfName(name: string): string | undefined {
  const rarity = RARITY_BY_KOREAN_NAME[name]

  if (rarity === undefined) {
    return undefined
  }

  return raritySolidClasses[rarity]
}

export const enhancementTextClasses = {
  enhance: 'text-game-enhance',
  amplify: 'text-game-amplify',
  refine: 'text-game-refine'
} as const

export const enhancementKindClasses = {
  reinforce: enhancementTextClasses.enhance,
  amplify: enhancementTextClasses.amplify,
  refine: enhancementTextClasses.refine
} as const
