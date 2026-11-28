export type LegendMark = 'line' | 'block'

export type LegendItem = Readonly<{
  key: string
  name: string
  color: string
  faded?: boolean
  mark: LegendMark
}>

const MIN_LEGEND_ITEMS = 2
const LEGEND_CLASS = 'm-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-xs text-fg-muted'
const LEGEND_ITEM_CLASS = 'flex items-center gap-2'
const MARK_CLASS = 'shrink-0 h-2 w-2 rounded-[2px]'
const LINE_MARK_CLASS = 'shrink-0 h-[2px] w-[14px] rounded-none'
const WIDE_MARK_CLASS = 'shrink-0 h-2 w-[14px] rounded-[2px]'
const DOT_MARK_CLASS = 'shrink-0 h-2 w-2 rounded-full'

const TOGGLE_CLASS = 'flex cursor-pointer items-center gap-2 transition-colors hover:text-fg'
const HIDDEN_TOGGLE_CLASS = 'text-fg-subtle line-through'

type LegendToggle = Readonly<{
  hiddenKeys: ReadonlySet<string>
  onToggle: (key: string) => void
}>

export function ChartLegend({
  items,
  below = false,
  toggle
}: {
  items: readonly LegendItem[]
  below?: boolean
  toggle?: LegendToggle
}): React.JSX.Element | null {
  if (items.length < MIN_LEGEND_ITEMS) {
    return null
  }

  return (
    <ul className={`${LEGEND_CLASS} ${below ? 'mt-3' : 'mb-3'}`}>
      {items.map((item) => (
        <li key={item.key} className={LEGEND_ITEM_CLASS}>
          <LegendItemView item={item} toggle={toggle} />
        </li>
      ))}
    </ul>
  )
}

function LegendItemView({
  item,
  toggle
}: {
  item: LegendItem
  toggle: LegendToggle | undefined
}): React.JSX.Element {
  if (toggle != null) {
    const off = toggle.hiddenKeys.has(item.key)
    const handleClick = (): void => toggle.onToggle(item.key)

    return (
      <button
        type="button"
        aria-pressed={!off}
        className={`${TOGGLE_CLASS} ${off ? HIDDEN_TOGGLE_CLASS : ''}`}
        onClick={handleClick}
      >
        <LegendEntry item={item} off={off} />
      </button>
    )
  }

  return <LegendEntry item={item} off={false} />
}

function LegendEntry({ item, off }: { item: LegendItem; off: boolean }): React.JSX.Element {
  const { name, color, faded, mark } = item
  const dimmed = faded || off

  return (
    <>
      <i
        aria-hidden="true"
        className={`${mark === 'line' ? LINE_MARK_CLASS : MARK_CLASS} ${dimmed ? 'opacity-50' : ''}`}
        style={{ backgroundColor: off ? 'var(--color-chart-base)' : color }}
      />
      {name}
    </>
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
