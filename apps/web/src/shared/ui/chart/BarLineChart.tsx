import { useRef, useState } from 'react'
import { LINE_REVEAL, useChartReveal } from './useChartReveal'
import { useChartSortSlide } from './useChartSortSlide'
import { useChartSvgBarGrow } from './useChartSvgBarGrow'
import { useChartTooltipSlide } from './useChartTooltipSlide'
import { ChartLegend, type LegendItem } from './ChartLegend'
import {
  alignedScale,
  definedRuns,
  lastDefined,
  niceScale,
  type Point,
  polylinePath,
  positionOf,
  stackPieces,
  topRoundedBarPath
} from './chart-geometry'
import type { LineSeries } from './LineChart'
import { ChartTooltip, HitList } from './plot-parts'
import {
  axisWidth,
  besideTooltipPlaceOf,
  AXIS_TEXT_CLASS,
  LINE_CLASS,
  type ChartX,
  type TooltipRow
} from './plot-layout'
import { useChartHover } from './useChartHover'
import { useChartSize } from './useChartSize'

export type BarSeries = Readonly<{
  key: string
  name: string
  color: string
  values: readonly number[]
}>

export type BarLayout = 'stack' | 'overlap'

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 196
const TOP = 8
const BOTTOM = 26
const TICK_LABEL_OFFSET = 4
const X_LABEL_BASELINE = 6
const Y_TICK_SPACING = 52
const BAR_SHARE = 0.62
const MIN_BAR_WIDTH = 2
const BAR_RADIUS = 3
const POINT_RADIUS = 2.5
// 좁은 화면에서만 x축 이름이 들어갈 폭으로 넓혀 가로로 스크롤한다.
const NARROW_SCROLL_CLASS = 'max-sm:overflow-x-auto'
const NARROW_WIDTH_CLASS = 'max-sm:min-w-(--narrow-width)'
const END_DOT_RADIUS = 4

type Formats = Readonly<{
  barTick: (value: number) => string
  barValue: (value: number) => string
  lineTick: (value: number) => string
  lineValue: (value: number) => string
}>

type BarLineChartProps = Readonly<{
  label: string
  x: readonly ChartX[]
  bars: readonly BarSeries[]
  layout: BarLayout
  line?: LineSeries
  selectedKey?: string
  formats: Formats
  height?: number
  narrowStep?: number
  toggleable?: boolean
  sortByTotal?: boolean
  barShares?: boolean
}>

export function BarLineChart(props: BarLineChartProps): React.JSX.Element | null {
  if (props.x.length === 0 || !hasBarLineValues(props)) {
    return null
  }

  return <BarLinePlot {...props} />
}

function BarLinePlot({
  label,
  x: givenX,
  bars,
  layout,
  line: givenLine,
  selectedKey,
  formats,
  height = DEFAULT_HEIGHT,
  narrowStep,
  toggleable = false,
  sortByTotal = false,
  barShares = false
}: BarLineChartProps): React.JSX.Element {
  const [hiddenKeys, setHiddenKeys] = useState<ReadonlySet<string>>(new Set())
  const givenBars = bars.filter(({ key }) => !hiddenKeys.has(key))
  const order = sortByTotal
    ? orderByTotal(givenBars, givenX.length)
    : givenX.map((_, index) => index)
  const x = order.flatMap((index) => givenX[index] ?? [])
  const shownBars = givenBars.map((bar) => {
    const values = reorder(bar.values, order, 0)

    return { ...bar, values }
  })
  let line: LineSeries | undefined

  if (givenLine != null) {
    const values = reorder(givenLine.values, order, null)
    line = { ...givenLine, values }
  }

  const { hover, show, areaProps } = useChartHover()
  const areaRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const hitsRef = useRef(new Map<string, HTMLElement>())
  const size = useChartSize(areaRef, { width: DEFAULT_WIDTH, height })
  const hoverIndex = hover.open ? x.findIndex(({ key }) => key === hover.key) : -1
  useChartSvgBarGrow(areaRef)
  useChartReveal(areaRef, LINE_REVEAL)
  useChartTooltipSlide({
    chartRef: areaRef,
    tooltipRef,
    anchorsRef: hitsRef,
    shownKey: hover.key ?? undefined,
    open: hover.open,
    bars: shownBars,
    placeOf: besideTooltipPlaceOf
  })

  const lineValues = line?.values.filter((value) => value != null) ?? []
  const barTotals = x.map((_, index) => barExtentAt(shownBars, layout, index))
  const plotBottom = size.height - BOTTOM
  const barScale = niceScale(0, Math.max(0, ...barTotals), tickCountOf(plotBottom - TOP))
  const lineScale = alignedScale(Math.max(0, ...lineValues), barScale.ticks.length - 1)
  const left = axisWidth(barScale.ticks.map(formats.barTick))
  const lineAxisWidth = line == null ? 0 : axisWidth(lineScale.ticks.map(formats.lineTick))
  const right = size.width - lineAxisWidth
  const step = x.length > 0 ? (right - left) / x.length : 0
  const barWidth = Math.max(MIN_BAR_WIDTH, step * BAR_SHARE)

  function centerOf(index: number): number {
    return left + step * (index + 0.5)
  }

  const centers = new Map(x.map(({ key }, index) => [key, centerOf(index)]))
  useChartSortSlide(areaRef, centers)

  function barY(value: number): number {
    return positionOf(value, barScale, plotBottom, TOP)
  }

  function lineY(value: number): number {
    return positionOf(value, lineScale, plotBottom, TOP)
  }

  function linePointOf({ index, value }: Point): Readonly<{ x: number; y: number }> {
    const pointX = centerOf(index)
    const pointY = lineY(value)

    return { x: pointX, y: pointY }
  }

  function toggleBar(key: string): void {
    setHiddenKeys((current) => {
      const next = new Set(current)

      if (next.has(key)) {
        next.delete(key)
      } else if (next.size < bars.length - 1) {
        next.add(key)
      }

      return next
    })
  }

  function registerHit(key: string, element: HTMLLIElement): () => void {
    hitsRef.current.set(key, element)

    return () => {
      hitsRef.current.delete(key)
    }
  }

  function rowsAt(index: number): TooltipRow[] {
    const total = shownBars.reduce((sum, { values }) => sum + Math.max(values[index] ?? 0, 0), 0)
    const barRows = shownBars.map(({ key, name, color, values }) => {
      const count = values[index] ?? 0
      const value = formats.barValue(count)
      const share = barShares ? shareOf(count, total) : undefined

      return { key, name, color, value, share }
    })
    const lineValue = line?.values[index]

    if (line == null || lineValue == null) {
      return barRows
    }

    const lineText = formats.lineValue(lineValue)
    const lineRow = { key: line.key, name: line.name, color: line.color, value: lineText }

    return [...barRows, lineRow]
  }

  const barLegend = bars.map(({ key, name, color }) => ({
    key,
    name,
    color,
    mark: 'block' as const
  }))
  const lineLegend: LegendItem[] =
    line != null ? [{ key: line.key, name: line.name, color: line.color, mark: 'line' }] : []
  const legend: LegendItem[] = [...barLegend, ...lineLegend]
  const selectedIndex = x.findIndex(({ key }) => key === selectedKey)
  const end = line != null ? lastDefined(line.values) : undefined
  const places = x.map((_, index) => ({ left: left + step * index, width: step }))
  const narrowWidth = narrowStep != null ? left + x.length * narrowStep : null
  const tickClass = narrowStep != null ? `${AXIS_TEXT_CLASS} sm:hidden` : AXIS_TEXT_CLASS

  return (
    <div className="relative flex grow flex-col p-4">
      <ChartLegend
        items={legend}
        toggle={toggleable ? { hiddenKeys, onToggle: toggleBar } : undefined}
      />
      <div className={`flex grow flex-col ${narrowWidth != null ? NARROW_SCROLL_CLASS : ''}`}>
        <div
          ref={areaRef}
          role="group"
          aria-label={label}
          className={`relative grow ${narrowWidth != null ? NARROW_WIDTH_CLASS : ''}`}
          style={{
            minHeight: height,
            ...(narrowWidth != null ? { '--narrow-width': `${narrowWidth}px` } : {})
          }}
        >
          <svg
            aria-hidden="true"
            width={size.width}
            height={size.height}
            viewBox={`0 0 ${size.width} ${size.height}`}
            className="absolute inset-0 block overflow-visible"
          >
            {selectedIndex >= 0 && (
              <rect
                x={left + step * selectedIndex}
                y={TOP}
                width={step}
                height={plotBottom - TOP}
                className="fill-inset"
              />
            )}
            {barScale.ticks.map((tick, index) => (
              <g key={tick}>
                <line
                  x1={left}
                  x2={right}
                  y1={barY(tick)}
                  y2={barY(tick)}
                  className={index === 0 ? 'stroke-line-strong stroke-1' : 'stroke-inset stroke-1'}
                />
                <text
                  x={left - TICK_LABEL_OFFSET * 2}
                  y={barY(tick) + TICK_LABEL_OFFSET}
                  textAnchor="end"
                  className={AXIS_TEXT_CLASS}
                >
                  {formats.barTick(tick)}
                </text>
              </g>
            ))}
            {line != null &&
              lineScale.ticks.slice(1).map((tick) => (
                <text
                  key={tick}
                  x={right + TICK_LABEL_OFFSET * 2}
                  y={lineY(tick) + TICK_LABEL_OFFSET}
                  className={`${AXIS_TEXT_CLASS} fill-fg`}
                >
                  {formats.lineTick(tick)}
                </text>
              ))}
            {x.map(({ key }, index) => (
              <g
                key={key}
                data-chart-bar=""
                data-chart-slot={key}
                className={`transition-opacity ${hoverIndex >= 0 && hoverIndex !== index ? 'opacity-30' : ''}`}
              >
                {barPiecesAt(shownBars, layout, index).map((piece) => {
                  const barX = centerOf(index) - barWidth / 2
                  const top = barY(piece.to)
                  const bottom = barY(piece.from)
                  const radius = piece.rounded ? BAR_RADIUS : 0
                  const path = topRoundedBarPath({ x: barX, width: barWidth, top, bottom, radius })

                  return <path key={piece.key} d={path} style={{ fill: piece.color }} />
                })}
              </g>
            ))}
            {x.map(
              ({ key, tick }, index) =>
                tick != null && (
                  <text
                    key={key}
                    data-chart-slot={key}
                    x={centerOf(index)}
                    y={size.height - X_LABEL_BASELINE}
                    textAnchor="middle"
                    className={tickClass}
                  >
                    {tick}
                  </text>
                )
            )}
            {line != null && (
              <g data-chart-reveal="">
                {definedRuns(line.values).map((run) => (
                  <path
                    key={run[0]?.index}
                    d={polylinePath(run.map(linePointOf))}
                    className={LINE_CLASS}
                    style={{ stroke: line.color }}
                  />
                ))}
                {definedRuns(line.values)
                  .flat()
                  .filter(({ index }) => index !== end?.index)
                  .map(({ index, value }) => (
                    <circle
                      key={index}
                      cx={centerOf(index)}
                      cy={lineY(value)}
                      r={POINT_RADIUS}
                      className="fill-canvas stroke-2"
                      style={{ stroke: line.color }}
                    />
                  ))}
              </g>
            )}
            {line != null && end != null && (
              <circle
                data-chart-end=""
                cx={centerOf(end.index)}
                cy={lineY(end.value)}
                r={END_DOT_RADIUS}
                className="stroke-canvas stroke-2"
                style={{ fill: line.color }}
              />
            )}
          </svg>
          <HitList
            x={x}
            places={places}
            onHover={show}
            areaProps={areaProps}
            register={registerHit}
          />
          <ChartTooltip
            tooltipRef={tooltipRef}
            title={hoverIndex >= 0 ? x[hoverIndex]?.title : undefined}
            rows={hoverIndex >= 0 ? rowsAt(hoverIndex) : []}
          />
        </div>
      </div>
    </div>
  )
}

type BarPiece = Readonly<{ key: string; color: string; from: number; to: number; rounded: boolean }>

function barExtentAt(bars: readonly BarSeries[], layout: BarLayout, index: number): number {
  const values = bars.map(({ values }) => Math.max(values[index] ?? 0, 0))
  if (layout === 'stack') {
    return values.reduce((sum, value) => sum + value, 0)
  }

  return Math.max(0, ...values)
}

function barPiecesAt(bars: readonly BarSeries[], layout: BarLayout, index: number): BarPiece[] {
  if (layout === 'stack') {
    const pieces = stackPieces(bars.map(({ values }) => values[index] ?? 0))

    return bars.flatMap(({ key, color }, order) => {
      const piece = pieces[order]

      if (piece == null || piece.to <= piece.from) {
        return []
      }

      return [{ key, color, from: piece.from, to: piece.to, rounded: piece.top }]
    })
  }

  return bars.flatMap(({ key, color, values }) => {
    const value = values[index] ?? 0

    if (value <= 0) {
      return []
    }

    return [{ key, color, from: 0, to: value, rounded: true }]
  })
}

function hasBarLineValues({ bars, line }: BarLineChartProps): boolean {
  const hasBars = bars.some(({ values }) => values.some((value) => value > 0))
  const hasLine = line?.values.some((value) => value != null) ?? false

  return hasBars || hasLine
}

function tickCountOf(plotHeight: number): number {
  return Math.max(2, Math.floor(plotHeight / Y_TICK_SPACING))
}

function orderByTotal(bars: readonly BarSeries[], length: number): number[] {
  const totals = Array.from({ length }, (_, index) =>
    bars.reduce((sum, { values }) => sum + Math.max(values[index] ?? 0, 0), 0)
  )

  return totals
    .map((total, index) => ({ total, index }))
    .toSorted((a, b) => b.total - a.total || a.index - b.index)
    .map(({ index }) => index)
}

function reorder<T>(values: readonly T[], order: readonly number[], missing: T): T[] {
  return order.map((index) => values[index] ?? missing)
}

const percent = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})

function shareOf(count: number, total: number): string {
  if (total <= 0) {
    return percent.format(0)
  }

  return percent.format(count / total)
}
