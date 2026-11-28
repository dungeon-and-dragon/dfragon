import { type Bar, type BarTone, RowBars } from '#shared/ui/chart/RowBars'
import { ItemIcon } from '#entities/character'
import { ItemTooltip } from '#widgets/item-tooltip'
import type { ItemBar } from './item-stats-bars'

function ItemLabel({ itemId, name }: { itemId: string; name: string }): React.JSX.Element {
  return (
    <ItemTooltip itemId={itemId}>
      <span className="inline-flex max-w-full items-center gap-2 align-middle">
        <ItemIcon itemId={itemId} rarity={null} size="sm" />
        <span className="truncate">{name}</span>
      </span>
    </ItemTooltip>
  )
}

function withItemLabel({ itemId, ...bar }: ItemBar): Bar {
  if (itemId === null) {
    return bar
  }

  return { ...bar, label: <ItemLabel itemId={itemId} name={bar.name} /> }
}

export function ItemRowBars({
  bars,
  tone,
  max,
  formatValue,
  barFromMd = false
}: {
  bars: readonly ItemBar[]
  tone: BarTone
  max?: number
  formatValue: (value: number) => string
  barFromMd?: boolean
}): React.JSX.Element {
  return (
    <RowBars
      bars={bars.map(withItemLabel)}
      tone={tone}
      max={max}
      formatValue={formatValue}
      barFromMd={barFromMd}
    />
  )
}
