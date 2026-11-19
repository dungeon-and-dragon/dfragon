import { useState } from 'react'
import type { ItemRarity } from '#entities/character/lib/character-detail-display'
import { itemIconUrl } from '#entities/character/lib/character-item'
import { raritySolidOf } from './game-colors'
import { itemPartClasses } from './item-part-classes'

export function ItemIcon({
  itemId,
  src,
  rarity
}: {
  itemId: string | null
  src?: string | null
  rarity: ItemRarity | null
}): React.JSX.Element {
  // Neople 이미지 서버에 그림이 없는 아이템(서약 본체 등)은 404라 빈 칸으로 둔다.
  const [failedItemId, setFailedItemId] = useState<string | null>(null)
  const className = `${itemPartClasses.icon} ${raritySolidOf(rarity)}`

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
