import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import { BOX_PLOT_REVEAL, useChartReveal } from '../../animations/useChartReveal'
import { useChartTooltipSlide } from '../../animations/useChartTooltipSlide'
import { BoxPlotLegend } from './ChartLegend'
import { boxPlotTooltipPlaceOf, boxStatsTooltipRows } from './box-plot-layout'
import { type BoxStats, boxPlotScale, positionOf, type Scale } from './chart-geometry'
import { ChartTooltip } from './plot-parts'
import { type Hover, NO_HOVER, type TooltipRow } from './plot-layout'
import { plotStyles } from './plot.style'
import { boxPlotStyles } from './box-plot.style'
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
const VALUE_WIDTH = 48
const EDGE = 24
const AXIS_HEIGHT = 14
const AXIS_BASELINE = 11
const INLINE_HEIGHT = 20
const CHART_ROW_HEIGHT = 24
const BOX_SHARE = 0.6
const CAP_HALF = 4
const DOT_SHARE = 0.15
const DEFAULT_PLOT_WIDTH = 360

function xOf(value: number, scale: Scale, width: number): number {
  return positionOf(value, scale, EDGE, width - EDGE)
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
      {...stylex.props(boxPlotStyles.svg)}
    >
      {scale.ticks.map((tick) => (
        <text
          key={tick}
          x={xOf(tick, scale, width)}
          y={AXIS_BASELINE}
          textAnchor="middle"
          {...stylex.props(plotStyles.axisText)}
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
      {...stylex.props(boxPlotStyles.svg)}
    >
      {scale.ticks.map((tick) => (
        <line
          key={tick}
          x1={xOf(tick, scale, width)}
          x2={xOf(tick, scale, width)}
          y1={0}
          y2={height}
          {...stylex.props(plotStyles.grid)}
        />
      ))}
      <g data-chart-reveal="">
        <path d={whisker} {...stylex.props(boxPlotStyles.whisker, plotStyles.stroke(color))} />
        <rect
          x={boxLeft}
          y={boxTop}
          width={Math.max(boxRight - boxLeft, 1)}
          height={boxHeight}
          rx={2}
          {...stylex.props(
            plotStyles.fill(color),
            faded && boxPlotStyles.boxFaded,
            faded && plotStyles.stroke(color)
          )}
        />
        <line
          x1={median}
          x2={median}
          y1={boxTop}
          y2={boxTop + boxHeight}
          {...stylex.props(boxPlotStyles.median)}
        />
      </g>
      <circle
        data-chart-end=""
        cx={xOf(stats.max, scale, width)}
        cy={middle}
        r={height * DOT_SHARE}
        {...stylex.props(plotStyles.fill(color))}
      />
    </svg>
  )
}

type BoxPlotChartProps = Readonly<{
  label: string
  rows: readonly BoxPlotRow[]
  formatTick: (value: number) => string
  formatValue: (value: number) => string
  scale?: Scale
  head?: BoxPlotHead
  nameWidth?: number
  legend?: boolean
}>

export function BoxPlotChart(props: BoxPlotChartProps): React.JSX.Element | null {
  const scale = props.scale ?? boxPlotScale(props.rows.flatMap(({ stats }) => stats ?? []))
  if (props.rows.length === 0 || scale == null) {
    return null
  }

  return <BoxPlotChartPlot {...props} scale={scale} />
}

function BoxPlotChartPlot({
  label,
  rows,
  scale,
  formatTick,
  formatValue,
  head,
  nameWidth = DEFAULT_NAME_WIDTH,
  legend = true
}: BoxPlotChartProps & { scale: Scale }): React.JSX.Element {
  const [hover, setHover] = useState<Hover>(NO_HOVER)
  const chartRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const anchorsRef = useRef(new Map<string, HTMLElement>())
  const { width } = useChartSize(plotRef, { width: DEFAULT_PLOT_WIDTH, height: CHART_ROW_HEIGHT })
  const shownRow = rows.find(({ key }) => key === hover.key)
  const hasValueColumn = head != null || rows.some(({ value }) => value != null)
  const valueWidth = hasValueColumn ? VALUE_WIDTH : 0
  const columns = boxPlotStyles.columns(nameWidth, valueWidth)
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

  function handleLeave(): void {
    setHover(({ key }) => ({ key, open: false }))
  }

  function tooltipRows({ stats, color }: BoxPlotRow): TooltipRow[] {
    if (stats === null) {
      return []
    }

    return boxStatsTooltipRows(stats, color, formatValue)
  }

  const shownTitle =
    shownRow != null ? [shownRow.name, shownRow.sub].filter(Boolean).join(' ') : undefined
  const shownRows = shownRow != null ? tooltipRows(shownRow) : []

  return (
    <div {...stylex.props(plotStyles.plot)}>
      <div ref={chartRef} role="group" aria-label={label} {...stylex.props(boxPlotStyles.chart)}>
        {head != null && (
          <div aria-hidden="true" {...stylex.props(boxPlotStyles.row, columns, boxPlotStyles.head)}>
            <span>{head.name}</span>
            <span>{head.plot}</span>
            <span {...stylex.props(boxPlotStyles.value)}>{head.value}</span>
          </div>
        )}
        <ul onMouseLeave={handleLeave} {...stylex.props(boxPlotStyles.rows)}>
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
              onHover={setHover}
              anchorsRef={anchorsRef}
            />
          ))}
        </ul>
        <div {...stylex.props(boxPlotStyles.row, columns)}>
          <span />
          <div ref={plotRef} {...stylex.props(boxPlotStyles.plotColumn)}>
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
  columns: stylex.StyleXStyles
  description: string
  onHover: (hover: Hover) => void
  anchorsRef: React.RefObject<Map<string, HTMLElement>>
}): React.JSX.Element {
  function handleMouseEnter(): void {
    onHover({ key, open: true })
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
      {...stylex.props(boxPlotStyles.row, columns)}
    >
      <span {...stylex.props(boxPlotStyles.name)}>
        {name}
        {sub != null && <small {...stylex.props(boxPlotStyles.sub)}> {sub}</small>}
        <span {...stylex.props(shapes.srOnly)}>{description}</span>
      </span>
      <div ref={plotRef} {...stylex.props(boxPlotStyles.plotColumn)}>
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
          <div {...stylex.props(boxPlotStyles.emptyPlot(CHART_ROW_HEIGHT))} />
        )}
      </div>
      {value != null && <span {...stylex.props(boxPlotStyles.value)}>{value}</span>}
    </li>
  )
}
