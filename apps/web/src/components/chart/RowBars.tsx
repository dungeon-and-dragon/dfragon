import { useRef, useState } from 'react'
import { ROW_BAR_GROW, useChartBarGrow } from '../../animations/useChartBarGrow'
import { type TooltipPlace, useChartTooltipSlide } from '../../animations/useChartTooltipSlide'
import { TOOLTIP_CLASS, TOOLTIP_COUNT_CLASS } from './plot-layout'

const integer = new Intl.NumberFormat('ko-KR')

export type Bar = Readonly<{
  key: string
  name: string
  sub?: string
  value: number
  share?: string
}>

export type BarTone = 'count' | 'fame'

type ShownTooltip = Readonly<{ key: string | null; open: boolean }>

const TOOLTIP_GAP = 8
const TOOLTIP_INSIDE_GAP = 10
// 값 열은 Monoplex KR 14px 숫자 9자(예: 1,914,430, 약 67px)가 한 줄에 들어가는 폭이다.
const ROW_COLUMNS_CLASS = 'grid-cols-[120px_minmax(0,1fr)_80px]'
const WIDE_NAME_ROW_COLUMNS_CLASS = 'grid-cols-[176px_minmax(0,1fr)_80px]'
const BODY_CLASS = 'absolute inset-0 transition-opacity duration-(--duration-hover) ease-standard'
const RAIL_CLASS =
  "relative block before:absolute before:inset-x-0 before:top-1/2 before:-mt-[0.5px] before:h-px before:bg-inset before:content-['']"

function percentOf(value: number, max: number): number {
  if (max <= 0) {
    return 0
  }

  return (value / max) * 100
}

function rowTooltipPlaceOf(
  mark: HTMLElement,
  tooltip: HTMLElement,
  list: HTMLElement
): TooltipPlace {
  const listBox = list.getBoundingClientRect()
  const markBox = mark.getBoundingClientRect()
  const railBox = (mark.parentElement ?? mark).getBoundingClientRect()
  const end = markBox.right - listBox.left
  const outside = end + TOOLTIP_GAP
  const fitsOutside = outside + tooltip.offsetWidth <= railBox.right - listBox.left
  const x = fitsOutside ? outside : end - TOOLTIP_INSIDE_GAP - tooltip.offsetWidth
  const row = mark.closest('li') ?? mark
  const rowBox = row.getBoundingClientRect()
  const y = rowBox.top - listBox.top + (rowBox.height - tooltip.offsetHeight) / 2

  return { x, y }
}

function formatInteger(value: number): string {
  return integer.format(value)
}

export function RowBars({
  bars,
  tone = 'count',
  max = Math.max(0, ...bars.map(({ value }) => value)),
  formatValue,
  fill = false
}: {
  bars: readonly Bar[]
  tone?: BarTone
  max?: number
  formatValue?: (value: number) => string
  fill?: boolean
}): React.JSX.Element {
  const [hover, setHover] = useState<ShownTooltip>({ key: null, open: false })
  const listRef = useRef<HTMLUListElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const marksRef = useRef(new Map<string, HTMLSpanElement>())
  const hasShare = bars.some(({ share }) => share != null)
  const hasSub = bars.some(({ sub }) => sub != null)
  const shownBar = bars.find(({ key }) => key === hover.key)
  useChartBarGrow(listRef, ROW_BAR_GROW)
  useChartTooltipSlide({
    chartRef: listRef,
    tooltipRef,
    anchorsRef: marksRef,
    shownKey: shownBar?.key,
    open: hover.open,
    bars,
    placeOf: rowTooltipPlaceOf
  })

  function handleHover(key: string): void {
    setHover({ key, open: true })
  }

  function handleLeave(): void {
    setHover(({ key }) => ({ key, open: false }))
  }

  function registerMark(key: string, element: HTMLSpanElement): () => void {
    marksRef.current.set(key, element)

    return () => {
      marksRef.current.delete(key)
    }
  }

  return (
    <div className={`relative ${fill ? 'flex grow flex-col' : ''}`}>
      <ul
        ref={listRef}
        onMouseLeave={handleLeave}
        className={`m-0 list-none p-4 ${fill ? 'flex grow flex-col justify-around' : ''}`}
      >
        {bars.map((bar) => (
          <BarRow
            key={bar.key}
            bar={bar}
            tone={tone}
            percent={percentOf(bar.value, max)}
            formatValue={formatValue ?? formatInteger}
            countUp={formatValue === undefined}
            thick={fill}
            wideName={hasSub}
            dimmed={hover.open && bar.key !== hover.key}
            onHover={handleHover}
            register={registerMark}
          />
        ))}
      </ul>
      {hasShare && (
        <span ref={tooltipRef} aria-hidden="true" className={`${TOOLTIP_CLASS} top-0`}>
          {shownBar?.share != null && <span className={TOOLTIP_COUNT_CLASS}>{shownBar.share}</span>}
        </span>
      )}
    </div>
  )
}

function BarRow({
  bar: { key, name, sub, value, share },
  tone,
  percent,
  formatValue,
  countUp,
  thick,
  wideName,
  dimmed,
  onHover,
  register
}: {
  bar: Bar
  tone: BarTone
  percent: number
  formatValue: (value: number) => string
  countUp: boolean
  thick: boolean
  wideName: boolean
  dimmed: boolean
  onHover: (key: string) => void
  register: (key: string, element: HTMLSpanElement) => () => void
}): React.JSX.Element {
  const fame = tone === 'fame'

  function handleMouseEnter(): void {
    onHover(key)
  }

  function markRef(element: HTMLSpanElement): () => void {
    return register(key, element)
  }

  return (
    <li
      data-chart-item=""
      onMouseEnter={handleMouseEnter}
      className={`grid h-7 items-center gap-x-3 text-sm ${wideName ? WIDE_NAME_ROW_COLUMNS_CLASS : ROW_COLUMNS_CLASS}`}
    >
      <span data-chart-name="" className="truncate">
        {name}
        {sub != null && <small className="text-xs text-fg-subtle"> {sub}</small>}
      </span>
      <span className={`${RAIL_CLASS} ${thick ? 'h-2.5' : 'h-1.5'}`}>
        <span
          ref={markRef}
          data-chart-mark=""
          className="absolute top-0 left-0 block h-full w-(--bar-width) min-w-0.5"
          style={{ '--bar-width': `${percent}%` }}
        >
          <span
            className={`${BODY_CLASS} ${thick ? 'rounded-[5px]' : 'rounded-[3px]'} ${fame ? 'bg-game-fame' : 'bg-chart-1'} ${dimmed ? 'opacity-30' : ''}`}
          />
        </span>
      </span>
      <span
        data-chart-count={countUp ? value : undefined}
        className={`text-right font-mono tabular-nums ${fame ? 'text-game-fame' : ''}`}
      >
        {formatValue(value)}
      </span>
      {share != null && <span className="sr-only">{share}</span>}
    </li>
  )
}
