import * as stylex from '@stylexjs/stylex'
import { MISSING_VALUE } from '@dfragon/client-core/constants/cards'
import { type ItemView, itemIconUrl } from '@dfragon/client-core/lib/character-item'
import type { ItemRarity } from '@dfragon/client-core/shared/search/character-detail-display'
import { styles as rarityText } from '../avatar/ItemName.style'
import { raritySolid, styles } from './item-parts.style'

type Tone = Readonly<{ rarity: ItemRarity | null }>

function textTone({ rarity }: Tone) {
  const key = rarity ?? 'unknown'

  return rarityText[key]
}

function solidTone({ rarity }: Tone) {
  const key = rarity ?? 'unknown'

  return raritySolid[key]
}

export function ItemIcon({ itemId, ...tone }: Tone & { itemId: string | null }): React.JSX.Element {
  if (itemId === null) {
    return <span aria-hidden="true" {...stylex.props(styles.icon, solidTone(tone))} />
  }

  return (
    <img
      src={itemIconUrl(itemId)}
      alt=""
      loading="lazy"
      {...stylex.props(styles.icon, solidTone(tone))}
    />
  )
}

export function ItemName({ name, ...tone }: Tone & { name: string | null }): React.JSX.Element {
  return <b {...stylex.props(styles.name, textTone(tone))}>{name ?? MISSING_VALUE}</b>
}

export function RarityBadge({
  children,
  ...tone
}: Tone & { children: React.ReactNode }): React.JSX.Element {
  return <span {...stylex.props(styles.badge, solidTone(tone))}>{children}</span>
}

export function TuneNumeral({ numeral }: { numeral: string | null }): React.JSX.Element | null {
  if (numeral === null) {
    return null
  }

  return <span {...stylex.props(styles.tune)}>{numeral}</span>
}

export function ItemCell({
  item,
  tune,
  exalted
}: {
  item: ItemView
  tune: string | null
  exalted: boolean
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.item)}>
      <ItemIcon itemId={item.itemId} rarity={item.rarity} />
      <span {...stylex.props(styles.itemText)}>
        <ItemName name={item.itemName} rarity={item.rarity} />
        <TuneNumeral numeral={tune} />
        {exalted && <RarityBadge rarity={item.rarity}>유일</RarityBadge>}
      </span>
    </div>
  )
}
