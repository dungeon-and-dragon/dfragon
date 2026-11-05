import * as stylex from '@stylexjs/stylex'
import { MISSING_VALUE } from '@dfragon/client-core/constants/cards'
import { type ItemRarity, itemIconUrl } from '@dfragon/client-core/lib/character-item'
import { oathSolid, oathText, raritySolid, rarityText, styles } from './item-parts.style'

type Tone = Readonly<{ rarity: ItemRarity | null; oath?: boolean }>

function isOathRarity(rarity: ItemRarity | null): rarity is keyof typeof oathText {
  return rarity !== null && rarity in oathText
}

function textTone({ rarity, oath = false }: Tone) {
  if (oath && isOathRarity(rarity)) {
    return oathText[rarity]
  }

  const key = rarity ?? 'unknown'

  return rarityText[key]
}

function solidTone({ rarity, oath = false }: Tone) {
  if (oath && isOathRarity(rarity)) {
    return oathSolid[rarity]
  }

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
