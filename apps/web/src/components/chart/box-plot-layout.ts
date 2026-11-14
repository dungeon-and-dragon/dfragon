import type { TooltipPlace } from '../../animations/useChartTooltipSlide'
import type { BoxStats } from './chart-geometry'
import type { TooltipRow } from './plot-layout'

const TOOLTIP_GAP = 8

export function boxStatsTooltipRows(
  stats: BoxStats,
  color: string,
  formatValue: (value: number) => string
): TooltipRow[] {
  const max = formatValue(stats.max)
  const p95 = formatValue(stats.p95)
  const p75 = formatValue(stats.p75)
  const median = formatValue(stats.median)
  const p25 = formatValue(stats.p25)
  const p5 = formatValue(stats.p5)

  return [
    { key: 'max', name: '최고', color, value: max },
    { key: 'p95', name: '95%', color, value: p95 },
    { key: 'p75', name: '75%', color, value: p75 },
    { key: 'median', name: '중앙값', color, value: median },
    { key: 'p25', name: '25%', color, value: p25 },
    { key: 'p5', name: '5%', color, value: p5 }
  ]
}

export function boxPlotTooltipPlaceOf(
  anchor: HTMLElement,
  tooltip: HTMLElement,
  chart: HTMLElement
): TooltipPlace {
  const chartBox = chart.getBoundingClientRect()
  const anchorBox = anchor.getBoundingClientRect()
  const right = anchorBox.right - chartBox.left + TOOLTIP_GAP
  const fitsRight = right + tooltip.offsetWidth <= chartBox.width
  const x = fitsRight
    ? right
    : Math.max(0, anchorBox.left - chartBox.left - TOOLTIP_GAP - tooltip.offsetWidth)
  const y = anchorBox.top - chartBox.top + (anchorBox.height - tooltip.offsetHeight) / 2

  return { x, y }
}
