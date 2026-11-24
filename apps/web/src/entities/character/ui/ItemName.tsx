import { MISSING_VALUE } from '#shared/lib/missing-value'
import type { ItemRarity } from '#entities/character/lib/character-detail-display'
import { rarityTextClasses } from './game-colors'
import { itemPartClasses } from './item-part-classes'

const WEIGHT_CLASSES = { semibold: itemPartClasses.name, normal: 'font-normal' } as const

export function ItemName({
  name,
  rarity,
  weight = 'semibold'
}: {
  name: string | null
  rarity: ItemRarity | null
  weight?: keyof typeof WEIGHT_CLASSES
}): React.JSX.Element {
  return (
    <b className={`${WEIGHT_CLASSES[weight]} ${rarityTextClasses[rarity ?? 'unknown']}`}>
      {name ?? MISSING_VALUE}
    </b>
  )
}
