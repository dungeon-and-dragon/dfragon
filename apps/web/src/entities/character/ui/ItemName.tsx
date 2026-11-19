import { MISSING_VALUE } from '#shared/lib/missing-value'
import type { ItemRarity } from '#entities/character/lib/character-detail-display'
import { rarityTextClasses } from './game-colors'
import { itemPartClasses } from './item-part-classes'

export function ItemName({
  name,
  rarity
}: {
  name: string | null
  rarity: ItemRarity | null
}): React.JSX.Element {
  return (
    <b className={`${itemPartClasses.name} ${rarityTextClasses[rarity ?? 'unknown']}`}>
      {name ?? MISSING_VALUE}
    </b>
  )
}
