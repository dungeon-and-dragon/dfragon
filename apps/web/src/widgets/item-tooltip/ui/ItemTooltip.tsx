import { Tooltip } from '@dfragon/ui'
import type { ReactElement } from 'react'
import { useItemDetail } from '#widgets/item-tooltip/api/useItemDetail'
import type { ItemCard, ItemDetail } from '#widgets/item-tooltip/model/item-detail'
import { ItemIcon, raritySolidOfName, rarityTextOfName } from '#entities/character'

const FAME_STATUS = '모험가 명성'
const FAILED = '아이템 정보를 받지 못했습니다.'
const integer = new Intl.NumberFormat('ko-KR')

function CardOptions({ card }: { card: ItemCard }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      <p className="m-0 text-fg-muted">{`부여 부위 ${card.slots.join(', ')}`}</p>
      {card.enchants.map(({ upgrade, status }) => (
        <div key={upgrade} className="flex flex-col">
          <b>{`+${upgrade}`}</b>
          <ul className="m-0 flex list-none flex-col p-0">
            {status.map(({ name, value }) => (
              <li key={name}>{`${name} ${value}`}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function ItemDetailCard({ item }: { item: ItemDetail }): React.JSX.Element {
  const status = item.status.filter(({ name }) => name !== FAME_STATUS)
  const nameTone = rarityTextOfName(item.rarity ?? '') ?? 'text-fg'

  return (
    <div className="flex w-[280px] flex-col gap-2 text-fg">
      <div className="flex items-start gap-2">
        <ItemIcon itemId={item.itemId} rarity={null} size="sm" />
        <b className={`min-w-0 grow text-sm ${nameTone}`}>{item.name}</b>
      </div>
      <div className="flex flex-col items-end text-fg-muted">
        {item.rarity !== null && (
          <span className={`${raritySolidOfName(item.rarity) ?? ''}`}>{item.rarity}</span>
        )}
        {item.availableLevel !== null && <span>{`레벨제한 ${item.availableLevel}`}</span>}
        {item.typeDetail !== null && <span>{item.typeDetail}</span>}
      </div>
      {item.fame !== null && (
        <p className="m-0 border-t border-line pt-2 text-game-fame">
          {`${FAME_STATUS} ${integer.format(item.fame)}`}
        </p>
      )}
      {status.length > 0 && (
        <ul className="m-0 flex list-none flex-col p-0">
          {status.map(({ name, value }) => (
            <li key={name}>{`${name} ${value}`}</li>
          ))}
        </ul>
      )}
      {item.card !== null && <CardOptions card={item.card} />}
      {item.explain !== null && (
        <p className="m-0 border-t border-line pt-2 whitespace-pre-line">{item.explain}</p>
      )}
      {item.flavorText !== null && (
        <p className="m-0 whitespace-pre-line text-fg-subtle">{item.flavorText}</p>
      )}
    </div>
  )
}

function ItemTooltipBody({ itemId }: { itemId: string }): React.JSX.Element {
  const result = useItemDetail(itemId)

  switch (result.status) {
    case 'loading':
      return <span className="skeleton block h-[160px] w-[280px]" />
    case 'error':
      return <p className="m-0 text-fg-muted">{FAILED}</p>
    case 'success':
      return <ItemDetailCard item={result.value} />
  }
}

export function ItemTooltip({
  itemId,
  children
}: {
  itemId: string
  children: ReactElement
}): React.JSX.Element {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={0} closeDelay={0} render={children} />
      <Tooltip.Popup side="right" align="start" sideOffset={8}>
        <div className="tooltip-item">
          <ItemTooltipBody itemId={itemId} />
        </div>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
