import { useRef } from 'react'
import { LINE_REVEAL, useChartReveal } from './useChartReveal'
import { useChartTooltipSlide } from './useChartTooltipSlide'
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
import {
  AXIS_TEXT_CLASS,
  LINE_CLASS,
  axisWidth,
  besideTooltipPlaceOf,
  type ChartX
} from './plot-layout'
import { useChartHover } from './useChartHover'
import { useChartSize } from './useChartSize'

export type LineSeries = Readonly<{
  key: string
  name: string
  color: string
  faded?: boolean
  values: readonly (number | null)[]
}>

export type LineAxisTick = Readonly<{ at: number; label: string }>

export type LineTimeAxis = Readonly<{ min: number; max: number; ticks: readonly LineAxisTick[] }>

export type TimedChartX = ChartX & Readonly<{ at: number }>

type LineXAxis =
  | Readonly<{ x: readonly ChartX[]; timeAxis?: undefined }>
  | Readonly<{ x: readonly TimedChartX[]; timeAxis: LineTimeAxis }>

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

type LineChartProps = LineXAxis &
  Readonly<{
    label: string
    series: readonly LineSeries[]
    formatTick: (value: number) => string
    formatValue: (value: number) => string
    height?: number
    selectedKey?: string
    fitValues?: boolean
  }>

export function LineChart(props: LineChartProps): React.JSX.Element | null {
  if (!hasLineValues(props.series) || props.x.length === 0) {
    return null
  }

  return <LinePlot {...props} />
}

function LinePlot(props: LineChartProps): React.JSX.Element {
  const {
    label,
    x,
    series,
    formatTick,
    formatValue,
    height = DEFAULT_HEIGHT,
    timeAxis,
    selectedKey,
    fitValues = false
  } = props
  const times = timesOf(props)
  const { hover, show, areaProps } = useChartHover()
  const areaRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const hitsRef = useRef(new Map<string, HTMLElement>())
  const size = useChartSize(areaRef, { width: DEFAULT_WIDTH, height })
  const drawn = series.filter(({ values }) => values.some((value) => value != null))
  const hoverIndex = hover.open ? x.findIndex(({ key }) => key === hover.key) : -1
  const selectedIndex = hoverIndex < 0 ? x.findIndex(({ key }) => key === selectedKey) : -1
  const crosshairIndex = hoverIndex >= 0 ? hoverIndex : selectedIndex
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
  const low = fitValues ? Math.min(...values) : 0
  const scale = niceScale(low, Math.max(low, ...values), tickCountOf(plotBottom - TOP))
  const left = axisWidth(scale.ticks.map(formatTick))
  const right = size.width - RIGHT
  const step = x.length > 1 ? (right - left) / (x.length - 1) : right - left
  const timedXs = times?.map(xAt)

  function xOf(index: number): number {
    const timed = timedXs?.[index]

    if (timed !== undefined) {
      return timed
    }

    if (x.length > 1) {
      return left + index * step
    }

    return (left + right) / 2
  }

  function xAt(at: number): number {
    if (timeAxis === undefined || timeAxis.max === timeAxis.min) {
      return (left + right) / 2
    }

    return left + ((at - timeAxis.min) / (timeAxis.max - timeAxis.min)) * (right - left)
  }

  function yOf(value: number): number {
    return positionOf(value, scale, plotBottom, TOP)
  }

  function pointOf({ index, value }: Point): Readonly<{ x: number; y: number }> {
    const pointX = xOf(index)
    const pointY = yOf(value)

    return { x: pointX, y: pointY }
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

  const places = x.map((_, index) => {
    const center = xOf(index)
    const start = index > 0 ? (xOf(index - 1) + center) / 2 : left
    const end = index < x.length - 1 ? (center + xOf(index + 1)) / 2 : right

    return { left: start, width: end - start }
  })

  return (
    <div className="relative flex grow flex-col p-4">
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
        className="relative grow"
        style={{ minHeight: height }}
      >
        <svg
          aria-hidden="true"
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          className="absolute inset-0 block overflow-visible"
        >
          {scale.ticks.map((tick, index) => (
            <g key={tick}>
              <line
                x1={left}
                x2={right}
                y1={yOf(tick)}
                y2={yOf(tick)}
                className={index === 0 ? 'stroke-line-strong stroke-1' : 'stroke-inset stroke-1'}
              />
              <text
                x={left - TICK_LABEL_OFFSET * 2}
                y={yOf(tick) + TICK_LABEL_OFFSET}
                textAnchor="end"
                className={AXIS_TEXT_CLASS}
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {timeAxis?.ticks.map(({ at, label }) => (
            <text
              key={at}
              x={xAt(at)}
              y={size.height - X_LABEL_BASELINE}
              textAnchor="middle"
              className={AXIS_TEXT_CLASS}
            >
              {label}
            </text>
          ))}
          {timeAxis === undefined &&
            x.map(
              ({ key, tick }, index) =>
                tick != null && (
                  <text
                    key={key}
                    x={xOf(index)}
                    y={size.height - X_LABEL_BASELINE}
                    textAnchor={anchorOf(index, x.length)}
                    className={AXIS_TEXT_CLASS}
                  >
                    {tick}
                  </text>
                )
            )}
          {crosshairIndex >= 0 && (
            <line
              x1={xOf(crosshairIndex)}
              x2={xOf(crosshairIndex)}
              y1={TOP}
              y2={plotBottom}
              className="stroke-line-strong stroke-1"
            />
          )}
          <g data-chart-reveal="">
            {drawn.flatMap(({ key, color, faded, values }) =>
              definedRuns(values).map((run) => (
                <path
                  key={`${key}-${run[0]?.index}`}
                  d={polylinePath(run.map(pointOf))}
                  className={`${LINE_CLASS} ${faded ? 'opacity-50' : ''}`}
                  style={{ stroke: color }}
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
                className={`stroke-canvas stroke-2 ${faded ? 'opacity-50' : ''}`}
                style={{ fill: color }}
              />
            )
          })}
          {crosshairIndex >= 0 &&
            drawn.map(({ key, color, faded, values }) => {
              const value = values[crosshairIndex]

              if (value == null) {
                return null
              }

              return (
                <circle
                  key={key}
                  cx={xOf(crosshairIndex)}
                  cy={yOf(value)}
                  r={hoverIndex >= 0 ? HOVER_DOT_RADIUS : END_DOT_RADIUS}
                  className={`fill-canvas stroke-2 ${faded ? 'opacity-50' : ''}`}
                  style={{ stroke: color }}
                />
              )
            })}
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
  )
}

function timesOf(axis: LineXAxis): readonly number[] | null {
  if (axis.timeAxis === undefined) {
    return null
  }

  return axis.x.map(({ at }) => at)
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
