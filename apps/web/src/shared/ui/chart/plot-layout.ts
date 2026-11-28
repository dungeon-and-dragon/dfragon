import type { TooltipPlace } from './useChartTooltipSlide'

export type ChartX = Readonly<{ key: string; title: string; tick: string | null }>

export type TooltipRow = Readonly<{
  key: string
  name: string
  color: string
  faded?: boolean
  value: string
  share?: string
}>

export type Hover = Readonly<{ key: string | null; open: boolean }>

export const NO_HOVER: Hover = { key: null, open: false }

// 처음에는 숨겨 두고, useChartTooltipSlide의 GSAP이 inline style의 visibility, opacity로 보이고 숨긴다.
export const TOOLTIP_CLASS =
  'pointer-events-none invisible absolute left-0 z-raised flex flex-col items-start rounded-control border border-line-strong bg-surface px-2 py-[5px] whitespace-nowrap opacity-0 shadow-popover'
export const TOOLTIP_TITLE_CLASS = 'text-xs text-fg-subtle'
export const TOOLTIP_COUNT_CLASS = 'num text-xs font-semibold'
export const LINE_CLASS = 'fill-none stroke-2 [stroke-linecap:round] [stroke-linejoin:round]'
// 눈금 글자는 "12.5만"처럼 한글 단위가 섞여 숫자 글꼴을 쓰지 않는다. Monoplex KR의 한글은 전각이라 좁은 막대 아래 라벨이 겹친다.
export const AXIS_TEXT_CLASS = 'fill-fg-subtle text-2xs tabular-nums'

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
