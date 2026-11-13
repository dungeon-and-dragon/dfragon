import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import { SPLIT_BAR_REVEAL, useChartReveal } from '../../animations/useChartReveal'
import { type TooltipPlace, useChartTooltipSlide } from '../../animations/useChartTooltipSlide'
import { splitLabelShown } from './chart-geometry'
import { ChartTooltip } from './plot-parts'
import { type Hover, NO_HOVER, type TooltipRow } from './plot-layout'
import { splitBarStyles } from './split-bar.style'

export type SplitSegment = Readonly<{
  key: string
  name: string
  value: number
  color: string
  textColor: string
}>

const TOOLTIP_GAP = 6
const percent = new Intl.NumberFormat('ko-KR', { style: 'percent', maximumFractionDigits: 1 })

function belowTooltipPlaceOf(
  anchor: HTMLElement,
  tooltip: HTMLElement,
  chart: HTMLElement
): TooltipPlace {
  const chartBox = chart.getBoundingClientRect()
  const anchorBox = anchor.getBoundingClientRect()
  const center = anchorBox.left + anchorBox.width / 2 - chartBox.left
  const x = Math.min(
    Math.max(0, center - tooltip.offsetWidth / 2),
    Math.max(0, chartBox.width - tooltip.offsetWidth)
  )
  const y = anchorBox.bottom - chartBox.top + TOOLTIP_GAP

  return { x, y }
}

type SplitBarProps = Readonly<{
  label: string
  segments: readonly SplitSegment[]
  formatValue: (value: number) => string
}>

export function SplitBar(props: SplitBarProps): React.JSX.Element | null {
  if (!props.segments.some(({ value }) => value > 0)) {
    return null
  }

  return <SplitBarPlot {...props} />
}

function SplitBarPlot({ label, segments, formatValue }: SplitBarProps): React.JSX.Element {
  const [hover, setHover] = useState<Hover>(NO_HOVER)
  const chartRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const anchorsRef = useRef(new Map<string, HTMLElement>())
  const shown = segments.filter(({ value }) => value > 0)
  const total = shown.reduce((sum, { value }) => sum + value, 0)
  const hovered = shown.find(({ key }) => key === hover.key)
  useChartReveal(chartRef, SPLIT_BAR_REVEAL)
  useChartTooltipSlide({
    chartRef,
    tooltipRef,
    anchorsRef,
    shownKey: hovered?.key,
    open: hover.open,
    bars: segments,
    placeOf: belowTooltipPlaceOf
  })

  function handleHover(key: string): void {
    setHover({ key, open: true })
  }

  function handleLeave(): void {
    setHover(({ key }) => ({ key, open: false }))
  }

  function registerSegment(key: string, element: HTMLLIElement): () => void {
    anchorsRef.current.set(key, element)

    return () => {
      anchorsRef.current.delete(key)
    }
  }

  function describe({ name, value }: SplitSegment): string {
    return `${name} ${formatValue(value)} ${percent.format(value / total)}`
  }

  function tooltipRows({ key, value, color }: SplitSegment): TooltipRow[] {
    const share = percent.format(value / total)
    const formatted = formatValue(value)

    return [{ key, name: share, color, value: formatted }]
  }

  const hoveredRows = hovered != null ? tooltipRows(hovered) : []

  return (
    <div ref={chartRef} role="group" aria-label={label} {...stylex.props(splitBarStyles.chart)}>
      <ul data-chart-reveal="" onMouseLeave={handleLeave} {...stylex.props(splitBarStyles.bar)}>
        {shown.map((segment) => (
          <Segment
            key={segment.key}
            segment={segment}
            text={splitLabelShown(segment.value, total) ? formatValue(segment.value) : null}
            description={describe(segment)}
            dimmed={hover.open && segment.key !== hover.key}
            onHover={handleHover}
            register={registerSegment}
          />
        ))}
      </ul>
      <ChartTooltip tooltipRef={tooltipRef} title={hovered?.name} rows={hoveredRows} />
    </div>
  )
}

function Segment({
  segment: { key, value, color, textColor },
  text,
  description,
  dimmed,
  onHover,
  register
}: {
  segment: SplitSegment
  text: string | null
  description: string
  dimmed: boolean
  onHover: (key: string) => void
  register: (key: string, element: HTMLLIElement) => () => void
}): React.JSX.Element {
  function handleMouseEnter(): void {
    onHover(key)
  }

  function segmentRef(element: HTMLLIElement): () => void {
    return register(key, element)
  }

  return (
    <li
      ref={segmentRef}
      onMouseEnter={handleMouseEnter}
      {...stylex.props(
        splitBarStyles.segment,
        dimmed && splitBarStyles.segmentDimmed,
        splitBarStyles.grow(value),
        splitBarStyles.colors(color, textColor)
      )}
    >
      {text != null && (
        <span aria-hidden="true" {...stylex.props(splitBarStyles.label)}>
          {text}
        </span>
      )}
      <span {...stylex.props(shapes.srOnly)}>{description}</span>
    </li>
  )
}
