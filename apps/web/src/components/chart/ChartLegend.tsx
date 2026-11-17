export type LegendMark = 'line' | 'block'

export type LegendItem = Readonly<{
  key: string
  name: string
  color: string
  faded?: boolean
  mark: LegendMark
}>

const MIN_LEGEND_ITEMS = 2
const LEGEND_CLASS = 'm-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-xs text-fg-muted'
const LEGEND_ITEM_CLASS = 'flex items-center gap-1.5'
const MARK_CLASS = 'shrink-0 h-2 w-2 rounded-[2px]'
const LINE_MARK_CLASS = 'shrink-0 h-0.5 w-3.5 rounded-none'
const WIDE_MARK_CLASS = 'shrink-0 h-2 w-3.5 rounded-[2px]'
const DOT_MARK_CLASS = 'shrink-0 h-2 w-2 rounded-full'

export function ChartLegend({
  items,
  below = false
}: {
  items: readonly LegendItem[]
  below?: boolean
}): React.JSX.Element | null {
  if (items.length < MIN_LEGEND_ITEMS) {
    return null
  }

  return (
    <ul className={`${LEGEND_CLASS} ${below ? 'mt-3' : 'mb-2.5'}`}>
      {items.map(({ key, name, color, faded, mark }) => (
        <li key={key} className={LEGEND_ITEM_CLASS}>
          <i
            aria-hidden="true"
            className={`${mark === 'line' ? LINE_MARK_CLASS : MARK_CLASS} ${faded ? 'opacity-50' : ''}`}
            style={{ backgroundColor: color }}
          />
          {name}
        </li>
      ))}
    </ul>
  )
}

const MEDIAN_MARK =
  'linear-gradient(90deg, var(--color-fg-muted) 0 40%, var(--color-canvas) 40% 60%, var(--color-fg-muted) 60%)'

export function BoxPlotLegend(): React.JSX.Element {
  return (
    <ul className={`${LEGEND_CLASS} mt-3`}>
      <li className={LEGEND_ITEM_CLASS}>
        <i aria-hidden="true" className={`${WIDE_MARK_CLASS} bg-fg-muted`} />
        25%~75%
      </li>
      <li className={LEGEND_ITEM_CLASS}>
        <i
          aria-hidden="true"
          className={WIDE_MARK_CLASS}
          style={{ backgroundImage: MEDIAN_MARK }}
        />
        중앙값
      </li>
      <li className={LEGEND_ITEM_CLASS}>
        <i aria-hidden="true" className={`${LINE_MARK_CLASS} bg-fg-muted`} />
        5%~95%
      </li>
      <li className={LEGEND_ITEM_CLASS}>
        <i aria-hidden="true" className={`${DOT_MARK_CLASS} bg-fg-muted`} />
        최고
      </li>
    </ul>
  )
}
