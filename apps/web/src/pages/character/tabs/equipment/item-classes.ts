import type { ItemRarity } from '#core/character/character-detail-display'

type RarityKey = ItemRarity | 'unknown'

export const rarityTextClasses: Readonly<Record<RarityKey, string>> = {
  common: 'text-rarity-common',
  uncommon: 'text-rarity-uncommon',
  rare: 'text-rarity-rare',
  unique: 'text-rarity-unique',
  legendary: 'text-rarity-legendary',
  epic: 'text-rarity-epic',
  chronicle: 'text-rarity-chronicle',
  primordial: 'bg-(image:--gradient-rarity-primordial) bg-clip-text text-transparent',
  mythic: 'bg-(image:--gradient-rarity-mythic) bg-clip-text text-transparent',
  unknown: 'text-fg'
}

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

export function raritySolidOf(rarity: ItemRarity | null): string {
  return raritySolidClasses[rarity ?? 'unknown']
}

export const itemClasses = {
  icon: 'box-border block size-game-icon shrink-0 rounded-badge border border-current bg-inset object-contain',
  iconSpace: 'size-game-icon shrink-0',
  name: 'font-semibold',
  item: 'flex min-w-0 items-center gap-3',
  itemText: 'flex min-w-0 flex-wrap items-center gap-2',
  strip:
    'box-border flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2',
  stripLabel: 'text-xs font-medium text-fg-subtle',
  stripMuted: 'text-fg-muted',
  stripNumber: 'font-mono tabular-nums text-fg-muted',
  spacer: 'grow'
} as const

export const itemTableClasses = {
  root: 'text-sm',
  slot: 'text-xs whitespace-nowrap text-fg-subtle',
  number: 'font-mono tabular-nums',
  muted: 'text-fg-muted',
  missing: 'text-fg-subtle',
  heading: 'section-title',
  count: 'section-title-count'
} as const
