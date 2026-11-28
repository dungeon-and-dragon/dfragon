import { useRef } from 'react'
import { ChartTooltip } from './plot-parts'
import { AXIS_TEXT_CLASS, type TooltipRow } from './plot-layout'
import {
  type PlacedSankeyFlow,
  type PlacedSankeyNode,
  ribbonPath,
  type SankeyFlow,
  type SankeyNode,
  sankeyLayout
} from './sankey-layout'
import { useChartHover } from './useChartHover'
import { SPLIT_BAR_REVEAL, useChartReveal } from './useChartReveal'
import { useChartSize } from './useChartSize'
import { type TooltipPlace, useChartTooltipSlide } from './useChartTooltipSlide'

export type { SankeyFlow, SankeyNode } from './sankey-layout'

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 320
const TITLE_HEIGHT = 20
const NODE_WIDTH = 10
const NODE_GAP = 14
const NODE_RADIUS = 2
const LABEL_WIDTH = 72
const LABEL_GAP = 8
const LABEL_LINE_GAP = 8
const FLOW_OPACITY = 0.45
const FOCUSED_FLOW_OPACITY = 0.7
const DIMMED_FLOW_OPACITY = 0.3
const FADED_NODE_OPACITY = 0.5
const TOOLTIP_GAP = 12
// 노드 라벨은 이름과 수 두 줄이라, 작은 노드가 붙어 있어도 이 간격보다 가깝게 두지 않는다.
const LABEL_SPACING = 32

type SankeyProps = Readonly<{
  label: string
  sourceTitle: string
  targetTitle: string
  sources: readonly SankeyNode[]
  targets: readonly SankeyNode[]
  flows: readonly SankeyFlow[]
  formatValue: (value: number) => string
  height?: number
}>

export function Sankey(props: SankeyProps): React.JSX.Element | null {
  if (!props.flows.some(({ value }) => value > 0)) {
    return null
  }

  return <SankeyPlot {...props} />
}

function besideFlowPlaceOf(
  anchor: HTMLElement,
  tooltip: HTMLElement,
  chart: HTMLElement
): TooltipPlace {
  const chartBox = chart.getBoundingClientRect()
  const anchorBox = anchor.getBoundingClientRect()
  const centerX = anchorBox.left - chartBox.left
  const centerY = anchorBox.top - chartBox.top
  const right = centerX + TOOLTIP_GAP
  const fitsRight = right + tooltip.offsetWidth <= chartBox.width
  const x = fitsRight ? right : Math.max(0, centerX - TOOLTIP_GAP - tooltip.offsetWidth)
  const maxY = Math.max(0, chartBox.height - tooltip.offsetHeight)
  const y = Math.min(Math.max(0, centerY - tooltip.offsetHeight / 2), maxY)

  return { x, y }
}

function SankeyPlot({
  label,
  sourceTitle,
  targetTitle,
  sources,
  targets,
  flows,
  formatValue,
  height = DEFAULT_HEIGHT
}: SankeyProps): React.JSX.Element {
  const { hover, show, areaProps } = useChartHover()
  const areaRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const anchorsRef = useRef(new Map<string, HTMLElement>())
  const size = useChartSize(areaRef, { width: DEFAULT_WIDTH, height })

  useChartReveal(areaRef, SPLIT_BAR_REVEAL)
  useChartTooltipSlide({
    chartRef: areaRef,
    tooltipRef,
    anchorsRef,
    shownKey: hover.key ?? undefined,
    open: hover.open,
    bars: flows,
    placeOf: besideFlowPlaceOf
  })

  const sourceX = LABEL_WIDTH + LABEL_GAP
  const targetX = size.width - LABEL_WIDTH - LABEL_GAP - NODE_WIDTH
  const layout = sankeyLayout({
    sources,
    targets,
    flows,
    top: TITLE_HEIGHT,
    height: size.height - TITLE_HEIGHT,
    gap: NODE_GAP
  })
  const focused = hover.open ? layout.flows.find(({ key }) => key === hover.key) : undefined

  function flowOpacity(key: string): number {
    if (focused === undefined) {
      return FLOW_OPACITY
    }

    if (focused.key === key) {
      return FOCUSED_FLOW_OPACITY
    }

    return DIMMED_FLOW_OPACITY * FLOW_OPACITY
  }

  function registerAnchor(key: string, element: HTMLSpanElement): () => void {
    anchorsRef.current.set(key, element)

    return () => {
      anchorsRef.current.delete(key)
    }
  }

  function tooltipRows({ key, name, color, value }: PlacedSankeyFlow): TooltipRow[] {
    const formatted = formatValue(value)

    return [{ key, name, color, value: formatted }]
  }

  const sourceLabelYs = labelCenters(layout.sources)
  const targetLabelYs = labelCenters(layout.targets)

  function nodeLabel(
    node: PlacedSankeyNode,
    index: number,
    side: 'source' | 'target'
  ): React.JSX.Element {
    const x = side === 'source' ? sourceX - LABEL_GAP : targetX + NODE_WIDTH + LABEL_GAP
    const anchor = side === 'source' ? 'end' : 'start'
    const centers = side === 'source' ? sourceLabelYs : targetLabelYs
    const middle = centers[index] ?? node.y + node.height / 2

    return (
      <g key={`${side}-label-${node.key}`}>
        <text x={x} y={middle - 2} textAnchor={anchor} className="fill-fg text-sm font-semibold">
          {node.name}
        </text>
        <text
          x={x}
          y={middle + LABEL_LINE_GAP + 4}
          textAnchor={anchor}
          className="fill-fg-muted text-xs tabular-nums"
        >
          {formatValue(node.value)}
        </text>
      </g>
    )
  }

  function nodeRect(node: PlacedSankeyNode, x: number, side: 'source' | 'target') {
    return (
      <rect
        key={`${side}-${node.key}`}
        x={x}
        y={node.y}
        width={NODE_WIDTH}
        height={node.height}
        rx={NODE_RADIUS}
        style={{ fill: node.color, opacity: node.faded ? FADED_NODE_OPACITY : 1 }}
      />
    )
  }

  const focusedRows = focused !== undefined ? tooltipRows(focused) : []

  return (
    <div className="relative flex grow flex-col p-4">
      <div
        ref={areaRef}
        {...areaProps}
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
          <text x={sourceX + NODE_WIDTH} y={12} textAnchor="end" className={AXIS_TEXT_CLASS}>
            {sourceTitle}
          </text>
          <text x={targetX} y={12} className={AXIS_TEXT_CLASS}>
            {targetTitle}
          </text>
          <g data-chart-reveal="">
            {layout.flows.map((flow) => (
              <FlowRibbon
                key={flow.key}
                flowKey={flow.key}
                path={ribbonPath(flow, sourceX + NODE_WIDTH, targetX)}
                color={flow.color}
                opacity={flowOpacity(flow.key)}
                onHover={show}
              />
            ))}
            {layout.sources.map((node) => nodeRect(node, sourceX, 'source'))}
            {layout.targets.map((node) => nodeRect(node, targetX, 'target'))}
          </g>
          {layout.sources.map((node, index) => nodeLabel(node, index, 'source'))}
          {layout.targets.map((node, index) => nodeLabel(node, index, 'target'))}
        </svg>
        {layout.flows.map((flow) => (
          <FlowAnchor
            key={flow.key}
            flowKey={flow.key}
            left={(sourceX + NODE_WIDTH + targetX) / 2}
            top={(flow.sourceY + flow.targetY + flow.thickness) / 2}
            register={registerAnchor}
          />
        ))}
        <ChartTooltip tooltipRef={tooltipRef} title={undefined} rows={focusedRows} />
      </div>
    </div>
  )
}

function labelCenters(nodes: readonly PlacedSankeyNode[]): number[] {
  const centers: number[] = []

  for (const node of nodes) {
    const previous = centers.at(-1)
    const middle = node.y + node.height / 2
    const center = previous !== undefined ? Math.max(middle, previous + LABEL_SPACING) : middle
    centers.push(center)
  }

  return centers
}

function FlowRibbon({
  flowKey,
  path,
  color,
  opacity,
  onHover
}: Readonly<{
  flowKey: string
  path: string
  color: string
  opacity: number
  onHover: (key: string) => void
}>): React.JSX.Element {
  function handleMouseEnter(): void {
    onHover(flowKey)
  }

  return (
    <path
      d={path}
      className="transition-opacity"
      style={{ fill: color, opacity }}
      onMouseEnter={handleMouseEnter}
    />
  )
}

function FlowAnchor({
  flowKey,
  left,
  top,
  register
}: Readonly<{
  flowKey: string
  left: number
  top: number
  register: (key: string, element: HTMLSpanElement) => () => void
}>): React.JSX.Element {
  function anchorRef(element: HTMLSpanElement): () => void {
    return register(flowKey, element)
  }

  return (
    <span
      ref={anchorRef}
      aria-hidden="true"
      className="pointer-events-none absolute size-0"
      style={{ left, top }}
    />
  )
}
