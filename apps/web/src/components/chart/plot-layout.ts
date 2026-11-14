import type { TooltipPlace } from '../../animations/useChartTooltipSlide'

export type ChartX = Readonly<{ key: string; title: string; tick: string | null }>

export type TooltipRow = Readonly<{
  key: string
  name: string
  color: string
  faded?: boolean
  value: string
}>

export type Hover = Readonly<{ key: string | null; open: boolean }>

export const NO_HOVER: Hover = { key: null, open: false }

const AXIS_CHAR_WIDTH = 7
const AXIS_GAP = 10
const TOOLTIP_GAP = 12

export function axisWidth(labels: readonly string[]): number {
  const longest = Math.max(0, ...labels.map((label) => label.length))

  return Math.ceil(longest * AXIS_CHAR_WIDTH) + AXIS_GAP
}

export function besideTooltipPlaceOf(
  anchor: HTMLElement,
  tooltip: HTMLElement,
  chart: HTMLElement
): TooltipPlace {
  const chartBox = chart.getBoundingClientRect()
  const anchorBox = anchor.getBoundingClientRect()
  const center = anchorBox.left + anchorBox.width / 2 - chartBox.left
  const right = center + TOOLTIP_GAP
  const fitsRight = right + tooltip.offsetWidth <= chartBox.width
  const x = fitsRight ? right : Math.max(0, center - TOOLTIP_GAP - tooltip.offsetWidth)

  return { x, y: 0 }
}
