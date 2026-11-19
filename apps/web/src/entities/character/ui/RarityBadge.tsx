import type { ItemRarity } from '#entities/character/lib/character-detail-display'
import { raritySolidOf } from './game-colors'

export function RarityBadge({
  children,
  rarity
}: {
  children: React.ReactNode
  rarity: ItemRarity | null
}): React.JSX.Element {
  return (
    <span className={`badge badge-sm border border-current ${raritySolidOf(rarity)}`}>
      {children}
    </span>
  )
}
