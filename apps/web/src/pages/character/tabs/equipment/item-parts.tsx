import {
  formatPoint,
  formatSetPointBonus,
  ItemIcon,
  ItemName,
  type ItemView,
  type SetPointBonusRule
} from '#entities/character'
import { itemClasses } from './item-classes'

export function TuneNumeral({ numeral }: { numeral: string | null }): React.JSX.Element | null {
  if (numeral === null) {
    return null
  }

  return <span className="label">{numeral}</span>
}

export function ItemCell({
  item,
  tune,
  potency = null
}: {
  item: ItemView
  tune: string | null
  potency?: string | null
}): React.JSX.Element {
  return (
    <div className={itemClasses.item}>
      <ItemIcon itemId={item.itemId} rarity={item.rarity} />
      <span className={itemClasses.itemText}>
        <ItemName name={item.itemName} rarity={item.rarity} />
        <TuneNumeral numeral={tune} />
        {potency !== null && <span className="num text-xs text-game-precision">{potency}</span>}
      </span>
    </div>
  )
}

export function SetPoint({
  point,
  rule
}: {
  point: number
  rule: SetPointBonusRule
}): React.JSX.Element {
  const bonus = formatSetPointBonus(point, rule)

  return (
    <>
      <span className={itemClasses.stripNumber}>{formatPoint(point)}</span>
      {bonus !== null && <span className={itemClasses.stripBonus}>{bonus}</span>}
    </>
  )
}
