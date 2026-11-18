import { useState } from 'react'
import { MISSING_VALUE } from '#core/capture'
import { itemIconUrl, type ItemRarity, type ItemView } from '#core/character'
import { raritySolidOf, rarityTextClasses } from '#components/game-colors'
import { itemClasses } from './item-classes'

type Tone = Readonly<{ rarity: ItemRarity | null }>

export function ItemIcon({
  itemId,
  src,
  rarity
}: Tone & { itemId: string | null; src?: string | null }): React.JSX.Element {
  // Neople 이미지 서버에 그림이 없는 아이템(서약 본체 등)은 404라 빈 칸으로 둔다.
  const [failedItemId, setFailedItemId] = useState<string | null>(null)
  const className = `${itemClasses.icon} ${raritySolidOf(rarity)}`

  if (itemId === null || itemId === failedItemId) {
    return <span aria-hidden="true" className={className} />
  }

  function handleError(): void {
    setFailedItemId(itemId)
  }

  return (
    <img
      src={src ?? itemIconUrl(itemId)}
      alt=""
      loading="lazy"
      onError={handleError}
      className={className}
    />
  )
}

export function ItemName({ name, rarity }: Tone & { name: string | null }): React.JSX.Element {
  return (
    <b className={`${itemClasses.name} ${rarityTextClasses[rarity ?? 'unknown']}`}>
      {name ?? MISSING_VALUE}
    </b>
  )
}

export function RarityBadge({
  children,
  rarity
}: Tone & { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className={`badge badge-sm border border-current ${raritySolidOf(rarity)}`}>
      {children}
    </span>
  )
}

export function TuneNumeral({ numeral }: { numeral: string | null }): React.JSX.Element | null {
  if (numeral === null) {
    return null
  }

  return <span className="label">{numeral}</span>
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
    <div className={itemClasses.item}>
      <ItemIcon itemId={item.itemId} rarity={item.rarity} />
      <span className={itemClasses.itemText}>
        <ItemName name={item.itemName} rarity={item.rarity} />
        <TuneNumeral numeral={tune} />
        {exalted && <RarityBadge rarity={item.rarity}>유일</RarityBadge>}
      </span>
    </div>
  )
}
