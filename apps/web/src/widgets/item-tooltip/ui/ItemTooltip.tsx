import { cardOptionRows, type EnchantRole } from '@dfragon/lib/enchant-options'
import { ItemDetailCard, type ItemDetailCardOptions, Tooltip } from '@dfragon/ui'
import type { ReactElement, ReactNode } from 'react'
import { useItemDetail } from '#widgets/item-tooltip/api/useItemDetail'
import type { ItemCard, ItemTooltipDetail } from '#widgets/item-tooltip/model/item-detail'
import { ItemIcon } from '#entities/character'

const FAILED = '아이템 정보를 받지 못했습니다.'

function cardOptions(
  card: ItemCard | null,
  role: EnchantRole | undefined
): ItemDetailCardOptions | null {
  if (card === null) {
    return null
  }

  const rows = cardOptionRows(card, role)

  return { slots: card.slots, rows }
}

function TooltipCard({
  item,
  icon,
  role
}: {
  item: ItemTooltipDetail
  icon: ReactNode
  role: EnchantRole | undefined
}): React.JSX.Element {
  const card = cardOptions(item.card, role)

  return <ItemDetailCard item={item} icon={icon} card={card} />
}

function ItemTooltipBody({
  itemId,
  role
}: {
  itemId: string
  role: EnchantRole | undefined
}): React.JSX.Element {
  const result = useItemDetail(itemId)

  switch (result.status) {
    case 'loading':
      return <span className="skeleton block h-[160px] w-[280px]" />
    case 'error':
      return <p className="m-0 text-fg-muted">{FAILED}</p>
    case 'success':
      return (
        <TooltipCard
          item={result.value}
          icon={<ItemIcon itemId={itemId} rarity={null} size="sm" />}
          role={role}
        />
      )
  }
}

// role을 주지 않으면 카드 옵션을 딜러와 버퍼 기준 모두로 강조한다.
export function ItemTooltip({
  itemId,
  role,
  children
}: {
  itemId: string
  role?: EnchantRole
  children: ReactElement
}): React.JSX.Element {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={0} closeDelay={0} render={children} />
      <Tooltip.Popup side="right" align="start" sideOffset={8}>
        <div className="tooltip-item">
          <ItemTooltipBody itemId={itemId} role={role} />
        </div>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

export function ItemDetailTooltip({
  item,
  iconUrl,
  role,
  children
}: {
  item: ItemTooltipDetail
  iconUrl: string | null
  role?: EnchantRole
  children: ReactElement
}): React.JSX.Element {
  const icon =
    iconUrl !== null ? (
      <img src={iconUrl} alt="" className="size-[24px]" />
    ) : (
      <ItemIcon itemId={null} rarity={null} size="sm" />
    )

  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={0} closeDelay={0} render={children} />
      <Tooltip.Popup side="right" align="start" sideOffset={8}>
        <div className="tooltip-item">
          <TooltipCard item={item} icon={icon} role={role} />
        </div>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
