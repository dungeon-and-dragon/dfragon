import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import { ROW_BAR_GROW, useChartBarGrow } from '../../animations/useChartBarGrow'
import { type TooltipPlace, useChartTooltipSlide } from '../../animations/useChartTooltipSlide'
import { styles } from './chart.style'

const integer = new Intl.NumberFormat('ko-KR')

export type Bar = Readonly<{ key: string; name: string; value: number; share?: string }>

export type BarTone = 'count' | 'fame'

type ShownTooltip = Readonly<{ key: string | null; open: boolean }>

const TOOLTIP_GAP = 8
const TOOLTIP_INSIDE_GAP = 10

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
    <div {...stylex.props(styles.chart, fill && styles.chartFill)}>
      <ul
        ref={listRef}
        onMouseLeave={handleLeave}
        {...stylex.props(styles.rows, fill && styles.rowsFill)}
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
            dimmed={hover.open && bar.key !== hover.key}
            onHover={handleHover}
            register={registerMark}
          />
        ))}
      </ul>
      {hasShare && (
        <span ref={tooltipRef} aria-hidden="true" {...stylex.props(styles.tooltip)}>
          {shownBar?.share != null && (
            <span {...stylex.props(styles.tooltipCount)}>{shownBar.share}</span>
          )}
        </span>
      )}
    </div>
  )
}

function BarRow({
  bar: { key, name, value, share },
  tone,
  percent,
  formatValue,
  countUp,
  thick,
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
    <li data-chart-item="" onMouseEnter={handleMouseEnter} {...stylex.props(styles.row)}>
      <span data-chart-name="" {...stylex.props(styles.rowName)}>
        {name}
      </span>
      <span {...stylex.props(styles.rail, thick && styles.railThick)}>
        <span
          ref={markRef}
          data-chart-mark=""
          {...stylex.props(styles.rowMark, styles.rowWidth(percent))}
        >
          <span
            {...stylex.props(
              styles.body,
              styles.rowBody,
              thick && styles.rowBodyThick,
              fame ? styles.bodyFame : styles.bodyCount,
              dimmed && styles.bodyDimmed
            )}
          />
        </span>
      </span>
      <span
        data-chart-count={countUp ? value : undefined}
        {...stylex.props(styles.value, fame && styles.valueFame)}
      >
        {formatValue(value)}
      </span>
      {share != null && <span {...stylex.props(shapes.srOnly)}>{share}</span>}
    </li>
  )
}
