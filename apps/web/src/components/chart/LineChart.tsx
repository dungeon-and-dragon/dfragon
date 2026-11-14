import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import { LINE_REVEAL, useChartReveal } from '../../animations/useChartReveal'
import { useChartTooltipSlide } from '../../animations/useChartTooltipSlide'
import { ChartLegend } from './ChartLegend'
import {
  definedRuns,
  lastDefined,
  niceScale,
  type Point,
  polylinePath,
  positionOf
} from './chart-geometry'
import { ChartTooltip, HitList } from './plot-parts'
import { axisWidth, besideTooltipPlaceOf, type ChartX, type Hover, NO_HOVER } from './plot-layout'
import { plotStyles } from './plot.style'
import { useChartSize } from './useChartSize'

export type LineSeries = Readonly<{
  key: string
  name: string
  color: string
  faded?: boolean
  values: readonly (number | null)[]
}>

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 250
const TOP = 8
const BOTTOM = 22
const RIGHT = 12
const TICK_LABEL_OFFSET = 4
const X_LABEL_BASELINE = 4
const Y_TICK_SPACING = 30
const END_DOT_RADIUS = 4
const HOVER_DOT_RADIUS = 5

type LineChartProps = Readonly<{
  label: string
  x: readonly ChartX[]
  series: readonly LineSeries[]
  formatTick: (value: number) => string
  formatValue: (value: number) => string
  height?: number
}>

export function LineChart(props: LineChartProps): React.JSX.Element | null {
  if (!hasLineValues(props.series) || props.x.length === 0) {
    return null
  }

  return <LinePlot {...props} />
}

function LinePlot({
  label,
  x,
  series,
  formatTick,
  formatValue,
  height = DEFAULT_HEIGHT
}: LineChartProps): React.JSX.Element {
  const [hover, setHover] = useState<Hover>(NO_HOVER)
  const areaRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const hitsRef = useRef(new Map<string, HTMLElement>())
  const size = useChartSize(areaRef, { width: DEFAULT_WIDTH, height })
  const drawn = series.filter(({ values }) => values.some((value) => value != null))
  const hoverIndex = hover.open ? x.findIndex(({ key }) => key === hover.key) : -1
  useChartReveal(areaRef, LINE_REVEAL)
  useChartTooltipSlide({
    chartRef: areaRef,
    tooltipRef,
    anchorsRef: hitsRef,
    shownKey: hover.key ?? undefined,
    open: hover.open,
    bars: drawn,
    placeOf: besideTooltipPlaceOf
  })

  const values = drawn.flatMap(({ values }) => values.filter((value) => value != null))
  const plotBottom = size.height - BOTTOM
  const scale = niceScale(0, Math.max(0, ...values), tickCountOf(plotBottom - TOP))
  const left = axisWidth(scale.ticks.map(formatTick))
  const right = size.width - RIGHT
  const step = x.length > 1 ? (right - left) / (x.length - 1) : right - left

  function xOf(index: number): number {
    if (x.length > 1) {
      return left + index * step
    }

    return (left + right) / 2
  }

  function yOf(value: number): number {
    return positionOf(value, scale, plotBottom, TOP)
  }

  function pointOf({ index, value }: Point): Readonly<{ x: number; y: number }> {
    const pointX = xOf(index)
    const pointY = yOf(value)

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

  function rowsAt(index: number) {
    return drawn.flatMap(({ key, name, color, faded, values }) => {
      const value = values[index]

      if (value == null) {
        return []
      }

      const formatted = formatValue(value)

      return [{ key, name, color, faded, value: formatted }]
    })
  }

  function describe(index: number): string {
    const rows = rowsAt(index).map(({ name, value }) => `${name} ${value}`)
    const title = x[index]?.title ?? ''

    return [title, ...rows].join(', ')
  }

  const places = x.map((_, index) => {
    const center = xOf(index)
    const start = Math.max(left, center - step / 2)
    const end = Math.min(right, center + step / 2)

    return { left: start, width: end - start }
  })

  return (
    <div {...stylex.props(plotStyles.plot)}>
      <ChartLegend
        items={drawn.map(({ key, name, color, faded }) => ({
          key,
          name,
          color,
          faded,
          mark: 'line'
        }))}
      />
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
          {scale.ticks.map((tick, index) => (
            <g key={tick}>
              <line
                x1={left}
                x2={right}
                y1={yOf(tick)}
                y2={yOf(tick)}
                {...stylex.props(index === 0 ? plotStyles.base : plotStyles.grid)}
              />
              <text
                x={left - TICK_LABEL_OFFSET * 2}
                y={yOf(tick) + TICK_LABEL_OFFSET}
                textAnchor="end"
                {...stylex.props(plotStyles.axisText)}
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {x.map(
            ({ key, tick }, index) =>
              tick != null && (
                <text
                  key={key}
                  x={xOf(index)}
                  y={size.height - X_LABEL_BASELINE}
                  textAnchor={anchorOf(index, x.length)}
                  {...stylex.props(plotStyles.axisText)}
                >
                  {tick}
                </text>
              )
          )}
          {hoverIndex >= 0 && (
            <line
              x1={xOf(hoverIndex)}
              x2={xOf(hoverIndex)}
              y1={TOP}
              y2={plotBottom}
              {...stylex.props(plotStyles.crosshair)}
            />
          )}
          <g data-chart-reveal="">
            {drawn.flatMap(({ key, color, faded, values }) =>
              definedRuns(values).map((run) => (
                <path
                  key={`${key}-${run[0]?.index}`}
                  d={polylinePath(run.map(pointOf))}
                  {...stylex.props(
                    plotStyles.line,
                    plotStyles.stroke(color),
                    faded && plotStyles.faded
                  )}
                />
              ))
            )}
          </g>
          {drawn.map(({ key, color, faded, values }) => {
            const end = lastDefined(values)

            if (end == null) {
              return null
            }

            return (
              <circle
                key={key}
                data-chart-end=""
                cx={xOf(end.index)}
                cy={yOf(end.value)}
                r={END_DOT_RADIUS}
                {...stylex.props(
                  plotStyles.endDot,
                  plotStyles.fill(color),
                  faded && plotStyles.faded
                )}
              />
            )
          })}
          {hoverIndex >= 0 &&
            drawn.map(({ key, color, faded, values }) => {
              const value = values[hoverIndex]

              if (value == null) {
                return null
              }

              return (
                <circle
                  key={key}
                  cx={xOf(hoverIndex)}
                  cy={yOf(value)}
                  r={HOVER_DOT_RADIUS}
                  {...stylex.props(
                    plotStyles.openDot,
                    plotStyles.stroke(color),
                    faded && plotStyles.faded
                  )}
                />
              )
            })}
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

function hasLineValues(series: readonly LineSeries[]): boolean {
  return series.some(({ values }) => values.some((value) => value != null))
}

function tickCountOf(plotHeight: number): number {
  return Math.max(2, Math.floor(plotHeight / Y_TICK_SPACING))
}

function anchorOf(index: number, count: number): 'start' | 'middle' | 'end' {
  if (count > 1 && index === 0) {
    return 'start'
  }

  if (count > 1 && index === count - 1) {
    return 'end'
  }

  return 'middle'
}
