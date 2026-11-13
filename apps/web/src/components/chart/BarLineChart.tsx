import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import { LINE_REVEAL, useChartReveal } from '../../animations/useChartReveal'
import { useChartSvgBarGrow } from '../../animations/useChartSvgBarGrow'
import { useChartTooltipSlide } from '../../animations/useChartTooltipSlide'
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
  type ChartX,
  type Hover,
  NO_HOVER,
  type TooltipRow
} from './plot-layout'
import { plotStyles } from './plot.style'
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
}>

export function BarLineChart(props: BarLineChartProps): React.JSX.Element | null {
  if (props.x.length === 0 || !hasBarLineValues(props)) {
    return null
  }

  return <BarLinePlot {...props} />
}

function BarLinePlot({
  label,
  x,
  bars,
  layout,
  line,
  selectedKey,
  formats,
  height = DEFAULT_HEIGHT
}: BarLineChartProps): React.JSX.Element {
  const [hover, setHover] = useState<Hover>(NO_HOVER)
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
    bars,
    placeOf: besideTooltipPlaceOf
  })

  const lineValues = line?.values.filter((value) => value != null) ?? []
  const barTotals = x.map((_, index) => barExtentAt(bars, layout, index))
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

  function handleHover(key: string): void {
    setHover({ key, open: true })
  }

  function handleLeave(): void {
    setHover(({ key }) => ({ key, open: false }))
  }

  function registerHit(key: string, element: HTMLLIElement): () => void {
    hitsRef.current.set(key, element)

    return () => {
      hitsRef.current.delete(key)
    }
  }

  function rowsAt(index: number): TooltipRow[] {
    const barRows = bars.map(({ key, name, color, values }) => {
      const value = formats.barValue(values[index] ?? 0)

      return { key, name, color, value }
    })
    const lineValue = line?.values[index]

    if (line == null || lineValue == null) {
      return barRows
    }

    const lineText = formats.lineValue(lineValue)
    const lineRow = { key: line.key, name: line.name, color: line.color, value: lineText }

    return [...barRows, lineRow]
  }

  function describe(index: number): string {
    const rows = rowsAt(index).map(({ name, value }) => `${name} ${value}`)
    const title = x[index]?.title ?? ''

    return [title, ...rows].join(', ')
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

  return (
    <div {...stylex.props(plotStyles.plot)}>
      <ChartLegend items={legend} />
      <div
        ref={areaRef}
        role="group"
        aria-label={label}
        {...stylex.props(plotStyles.area, plotStyles.areaHeight(height))}
      >
        <svg
          aria-hidden="true"
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          {...stylex.props(plotStyles.svg)}
        >
          {selectedIndex >= 0 && (
            <rect
              x={left + step * selectedIndex}
              y={TOP}
              width={step}
              height={plotBottom - TOP}
              {...stylex.props(plotStyles.selected)}
            />
          )}
          {barScale.ticks.map((tick, index) => (
            <g key={tick}>
              <line
                x1={left}
                x2={right}
                y1={barY(tick)}
                y2={barY(tick)}
                {...stylex.props(index === 0 ? plotStyles.base : plotStyles.grid)}
              />
              <text
                x={left - TICK_LABEL_OFFSET * 2}
                y={barY(tick) + TICK_LABEL_OFFSET}
                textAnchor="end"
                {...stylex.props(plotStyles.axisText)}
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
                {...stylex.props(plotStyles.axisText, plotStyles.axisTextStrong)}
              >
                {formats.lineTick(tick)}
              </text>
            ))}
          {x.map(({ key }, index) => (
            <g
              key={key}
              data-chart-bar=""
              {...stylex.props(
                plotStyles.bar,
                hoverIndex >= 0 && hoverIndex !== index && plotStyles.barDimmed
              )}
            >
              {barPiecesAt(bars, layout, index).map((piece) => {
                const barX = centerOf(index) - barWidth / 2
                const top = barY(piece.to)
                const bottom = barY(piece.from)
                const radius = piece.rounded ? BAR_RADIUS : 0
                const path = topRoundedBarPath({ x: barX, width: barWidth, top, bottom, radius })

                return (
                  <path key={piece.key} d={path} {...stylex.props(plotStyles.fill(piece.color))} />
                )
              })}
            </g>
          ))}
          {x.map(
            ({ key, tick }, index) =>
              tick != null && (
                <text
                  key={key}
                  x={centerOf(index)}
                  y={size.height - X_LABEL_BASELINE}
                  textAnchor="middle"
                  {...stylex.props(plotStyles.axisText)}
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
                  {...stylex.props(plotStyles.line, plotStyles.stroke(line.color))}
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
                    {...stylex.props(plotStyles.openDot, plotStyles.stroke(line.color))}
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
              {...stylex.props(plotStyles.endDot, plotStyles.fill(line.color))}
            />
          )}
        </svg>
        <HitList
          x={x}
          places={places}
          describe={describe}
          onHover={handleHover}
          onLeave={handleLeave}
          register={registerHit}
        />
        <ChartTooltip
          tooltipRef={tooltipRef}
          title={hoverIndex >= 0 ? x[hoverIndex]?.title : undefined}
          rows={hoverIndex >= 0 ? rowsAt(hoverIndex) : []}
        />
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
