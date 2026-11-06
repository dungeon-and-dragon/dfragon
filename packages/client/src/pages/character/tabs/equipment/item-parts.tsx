import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { MISSING_VALUE } from '@dfragon/client-core/constants/cards'
import { itemIconUrl } from '@dfragon/client-core/lib/character-item'
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
  // Neople 이미지 서버에 그림이 없는 아이템(서약 본체 등)은 404라 빈 칸으로 둔다.
  const [failedItemId, setFailedItemId] = useState<string | null>(null)
  if (itemId === null || itemId === failedItemId) {
    return <span aria-hidden="true" {...stylex.props(styles.icon, solidTone(tone))} />
  }

  function handleError(): void {
    setFailedItemId(itemId)
  }

  return (
    <img
      src={itemIconUrl(itemId)}
      alt=""
      loading="lazy"
      onError={handleError}
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
