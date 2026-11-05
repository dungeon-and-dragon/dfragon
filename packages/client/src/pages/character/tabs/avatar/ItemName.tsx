import * as stylex from '@stylexjs/stylex'
import { itemRarityOf } from '@dfragon/client-core/shared/search/character-detail-display'
import { styles } from './ItemName.style'

export function ItemName({
  name,
  rarity
}: {
  name: string
  rarity: string | null
}): React.JSX.Element {
  const tone = itemRarityOf(rarity) ?? 'unknown'

  return <span {...stylex.props(styles[tone])}>{name}</span>
}
