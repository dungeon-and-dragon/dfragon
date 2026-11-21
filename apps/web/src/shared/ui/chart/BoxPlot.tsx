import { useRef } from 'react'
import { BOX_PLOT_REVEAL, useChartReveal } from './useChartReveal'
import { useChartTooltipSlide } from './useChartTooltipSlide'
import { BoxPlotLegend } from './ChartLegend'
import {
  BOX_PLOT_EDGE,
  boxPlotScaleFor,
  boxPlotTooltipPlaceOf,
  boxStatsTooltipRows
} from './box-plot-layout'
import { type BoxStats, positionOf, type Scale } from './chart-geometry'
import { ChartTooltip } from './plot-parts'
import { AXIS_TEXT_CLASS, type TooltipRow } from './plot-layout'
import { useChartHover } from './useChartHover'
import { useChartSize } from './useChartSize'

export type BoxPlotRow = Readonly<{
  key: string
  name: string
  sub?: string
  color: string
  faded?: boolean
  stats: BoxStats | null
  value?: string
}>

export type BoxPlotHead = Readonly<{ name: string; plot: string; value: string }>

const DEFAULT_NAME_WIDTH = 120
// Monoplex KR의 숫자와 쉼표는 0.528em이라 14px로 7자(예: 120,000)가 약 52px다.
const VALUE_WIDTH = 64
const AXIS_HEIGHT = 14
const AXIS_BASELINE = 11
const INLINE_HEIGHT = 20
const CHART_ROW_HEIGHT = 24
const BOX_SHARE = 0.6
const CAP_HALF = 4
const DOT_SHARE = 0.15
const DEFAULT_PLOT_WIDTH = 360
const ROW_CLASS = 'grid items-center gap-x-2'
const VALUE_CLASS = 'text-right num text-sm'

function gridColumnsOf(nameWidth: number, valueWidth: number): React.CSSProperties {
  const gridTemplateColumns =
    valueWidth > 0
      ? `${nameWidth}px minmax(0, 1fr) ${valueWidth}px`
      : `${nameWidth}px minmax(0, 1fr)`

  return { gridTemplateColumns }
}

function xOf(value: number, scale: Scale, width: number): number {
  return positionOf(value, scale, BOX_PLOT_EDGE, width - BOX_PLOT_EDGE)
}

export function BoxPlotAxis({
  scale,
  width,
  formatTick
}: {
  scale: Scale
  width: number
  formatTick: (value: number) => string
}): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={AXIS_HEIGHT}
      viewBox={`0 0 ${width} ${AXIS_HEIGHT}`}
      className="block overflow-visible"
    >
      {scale.ticks.map((tick) => (
        <text
          key={tick}
          x={xOf(tick, scale, width)}
          y={AXIS_BASELINE}
          textAnchor="middle"
          className={AXIS_TEXT_CLASS}
        >
          {formatTick(tick)}
        </text>
      ))}
    </svg>
  )
}

export function BoxPlot({
  stats,
  color,
  faded = false,
  scale,
  width,
  height = INLINE_HEIGHT
}: {
  stats: BoxStats
  color: string
  faded?: boolean
  scale: Scale
  width: number
  height?: number
}): React.JSX.Element {
  const middle = height / 2
  const boxHeight = Math.round(height * BOX_SHARE)
  const boxTop = middle - boxHeight / 2
  const low = xOf(stats.p5, scale, width)
  const high = xOf(stats.p95, scale, width)
  const boxLeft = xOf(stats.p25, scale, width)
  const boxRight = xOf(stats.p75, scale, width)
  const median = xOf(stats.median, scale, width)
  const whisker = `M${low} ${middle} H${high} M${low} ${middle - CAP_HALF} V${middle + CAP_HALF} M${high} ${middle - CAP_HALF} V${middle + CAP_HALF}`

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block overflow-visible"
    >
      {scale.ticks.map((tick) => (
        <line
          key={tick}
          x1={xOf(tick, scale, width)}
          x2={xOf(tick, scale, width)}
          y1={0}
          y2={height}
          className="stroke-inset stroke-1"
        />
      ))}
      <g data-chart-reveal="">
        <path d={whisker} className="fill-none stroke-[1.5]" style={{ stroke: color }} />
        <rect
          x={boxLeft}
          y={boxTop}
          width={Math.max(boxRight - boxLeft, 1)}
          height={boxHeight}
          rx={2}
          className={faded ? '[fill-opacity:0.5] stroke-1' : undefined}
          style={faded ? { fill: color, stroke: color } : { fill: color }}
        />
        <line
          x1={median}
          x2={median}
          y1={boxTop}
          y2={boxTop + boxHeight}
          className="stroke-canvas stroke-2"
        />
      </g>
      <circle
        data-chart-end=""
        cx={xOf(stats.max, scale, width)}
        cy={middle}
        r={height * DOT_SHARE}
        style={{ fill: color }}
      />
    </svg>
  )
}

type BoxPlotChartProps = Readonly<{
  label: string
  rows: readonly BoxPlotRow[]
  formatTick: (value: number) => string
  formatValue: (value: number) => string
  domain?: readonly BoxStats[]
  head?: BoxPlotHead
  nameWidth?: number
  legend?: boolean
}>

export function BoxPlotChart(props: BoxPlotChartProps): React.JSX.Element | null {
  const domain = props.domain ?? props.rows.flatMap(({ stats }) => stats ?? [])
  if (props.rows.length === 0 || domain.length === 0) {
    return null
  }

  return <BoxPlotChartPlot {...props} domain={domain} />
}

function BoxPlotChartPlot({
  label,
  rows,
  domain,
  formatTick,
  formatValue,
  head,
  nameWidth = DEFAULT_NAME_WIDTH,
  legend = true
}: BoxPlotChartProps & { domain: readonly BoxStats[] }): React.JSX.Element | null {
  const { hover, show, areaProps } = useChartHover()
  const chartRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const anchorsRef = useRef(new Map<string, HTMLElement>())
  const { width } = useChartSize(plotRef, { width: DEFAULT_PLOT_WIDTH, height: CHART_ROW_HEIGHT })
  const scale = boxPlotScaleFor(domain, width)
  const shownRow = rows.find(({ key }) => key === hover.key)
  const hasValueColumn = head != null || rows.some(({ value }) => value != null)
  const valueWidth = hasValueColumn ? VALUE_WIDTH : 0
  const columns = gridColumnsOf(nameWidth, valueWidth)
  useChartReveal(chartRef, BOX_PLOT_REVEAL)
  useChartTooltipSlide({
    chartRef,
    tooltipRef,
    anchorsRef,
    shownKey: shownRow?.key,
    open: hover.open,
    bars: rows,
    placeOf: boxPlotTooltipPlaceOf
  })

  function tooltipRows({ stats, color }: BoxPlotRow): TooltipRow[] {
    if (stats === null) {
      return []
    }

    return boxStatsTooltipRows(stats, color, formatValue)
  }

  const shownTitle =
    shownRow != null ? [shownRow.name, shownRow.sub].filter(Boolean).join(' ') : undefined
  const shownRows = shownRow != null ? tooltipRows(shownRow) : []

  if (scale === undefined) {
    return null
  }

  return (
    <div className="relative flex grow flex-col p-4">
      <div ref={chartRef} role="group" aria-label={label} className="relative">
        {head != null && (
          <div
            aria-hidden="true"
            className={`${ROW_CLASS} h-[22px] text-xs text-fg-subtle`}
            style={columns}
          >
            <span>{head.name}</span>
            <span>{head.plot}</span>
            <span className="text-right text-sm">{head.value}</span>
          </div>
        )}
        <ul {...areaProps} className="m-0 list-none p-0">
          {rows.map((row) => (
            <BoxPlotChartRow
              key={row.key}
              row={row}
              scale={scale}
              width={width}
              columns={columns}
              description={tooltipRows(row)
                .map(({ name, value }) => `${name} ${value}`)
                .join(', ')}
              onHover={show}
              anchorsRef={anchorsRef}
            />
          ))}
        </ul>
        <div className={ROW_CLASS} style={columns}>
          <span />
          <div ref={plotRef} className="min-w-0">
            <BoxPlotAxis scale={scale} width={width} formatTick={formatTick} />
          </div>
        </div>
        <ChartTooltip tooltipRef={tooltipRef} title={shownTitle} rows={shownRows} />
      </div>
      {legend && <BoxPlotLegend />}
    </div>
  )
}

function BoxPlotChartRow({
  row: { key, name, sub, color, faded, stats, value },
  scale,
  width,
  columns,
  description,
  onHover,
  anchorsRef
}: {
  row: BoxPlotRow
  scale: Scale
  width: number
  columns: React.CSSProperties
  description: string
  onHover: (key: string) => void
  anchorsRef: React.RefObject<Map<string, HTMLElement>>
}): React.JSX.Element {
  function handleMouseEnter(): void {
    onHover(key)
  }

  function plotRef(element: HTMLDivElement): () => void {
    anchorsRef.current.set(key, element)

    return () => {
      anchorsRef.current.delete(key)
    }
  }

  return (
    <li
      data-chart-item=""
      onMouseEnter={stats !== null ? handleMouseEnter : undefined}
      className={ROW_CLASS}
      style={columns}
    >
      <span className="truncate text-xs text-fg-muted">
        {name}
        {sub != null && <small className="text-xs text-fg-subtle"> {sub}</small>}
        <span className="sr-only">{description}</span>
      </span>
      <div ref={plotRef} className="min-w-0">
        {stats !== null ? (
          <BoxPlot
            stats={stats}
            color={color}
            faded={faded}
            scale={scale}
            width={width}
            height={CHART_ROW_HEIGHT}
          />
        ) : (
          <div style={{ height: CHART_ROW_HEIGHT }} />
        )}
      </div>
      {value != null && <span className={VALUE_CLASS}>{value}</span>}
    </li>
  )
}
