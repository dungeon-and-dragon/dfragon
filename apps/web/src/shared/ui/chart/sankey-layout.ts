export type SankeyNode = Readonly<{ key: string; name: string; color: string; faded?: boolean }>

export type SankeyFlow = Readonly<{
  key: string
  name: string
  from: string
  to: string
  value: number
  color: string
}>

export type PlacedSankeyNode = SankeyNode & Readonly<{ value: number; y: number; height: number }>

export type PlacedSankeyFlow = SankeyFlow &
  Readonly<{ sourceY: number; targetY: number; thickness: number }>

export type SankeyLayout = Readonly<{
  sources: PlacedSankeyNode[]
  targets: PlacedSankeyNode[]
  flows: PlacedSankeyFlow[]
}>

type SankeyInput = Readonly<{
  sources: readonly SankeyNode[]
  targets: readonly SankeyNode[]
  flows: readonly SankeyFlow[]
  top: number
  height: number
  gap: number
}>

const MIN_NODE_HEIGHT = 2

function placeNodes(
  nodes: readonly SankeyNode[],
  nodeValue: (key: string) => number,
  scale: number,
  { top, height, gap }: Pick<SankeyInput, 'top' | 'height' | 'gap'>
): PlacedSankeyNode[] {
  const shown = nodes.filter(({ key }) => nodeValue(key) > 0)
  const heights = shown.map(({ key }) => Math.max(nodeValue(key) * scale, MIN_NODE_HEIGHT))
  const used = heights.reduce((sum, nodeHeight) => sum + nodeHeight, 0) + gap * (shown.length - 1)
  let y = top + Math.max(0, (height - used) / 2)

  return shown.map((node, index) => {
    const nodeHeight = heights[index] ?? 0
    const value = nodeValue(node.key)
    const placed = { ...node, value, y, height: nodeHeight }
    y += nodeHeight + gap

    return placed
  })
}

// 흐름은 반대편 노드 순서로 쌓아 서로 덜 엇갈리게 한다.
export function sankeyLayout({
  sources,
  targets,
  flows,
  top,
  height,
  gap
}: SankeyInput): SankeyLayout {
  const shownFlows = flows.filter(({ value }) => value > 0)
  const sumBy = (side: 'from' | 'to') => (key: string) =>
    shownFlows.filter((flow) => flow[side] === key).reduce((sum, { value }) => sum + value, 0)
  const sourceValue = sumBy('from')
  const targetValue = sumBy('to')
  const total = shownFlows.reduce((sum, { value }) => sum + value, 0)
  const nodeCount = Math.max(
    sources.filter(({ key }) => sourceValue(key) > 0).length,
    targets.filter(({ key }) => targetValue(key) > 0).length
  )
  const scale = total > 0 ? Math.max(0, height - gap * (nodeCount - 1)) / total : 0
  const area = { top, height, gap }
  const placedSources = placeNodes(sources, sourceValue, scale, area)
  const placedTargets = placeNodes(targets, targetValue, scale, area)
  const orderOf = (nodes: readonly SankeyNode[], key: string) =>
    nodes.findIndex((node) => node.key === key)
  const sourceCursor = new Map(placedSources.map(({ key, y }) => [key, y]))
  const targetCursor = new Map(placedTargets.map(({ key, y }) => [key, y]))
  const sourceYs = new Map<string, number>()
  const targetYs = new Map<string, number>()

  const bySource = shownFlows.toSorted((left, right) => {
    const sourceOrder = orderOf(sources, left.from) - orderOf(sources, right.from)

    if (sourceOrder !== 0) {
      return sourceOrder
    }

    return orderOf(targets, left.to) - orderOf(targets, right.to)
  })

  for (const flow of bySource) {
    const y = sourceCursor.get(flow.from) ?? top
    sourceYs.set(flow.key, y)
    sourceCursor.set(flow.from, y + flow.value * scale)
  }

  const byTarget = shownFlows.toSorted((left, right) => {
    const targetOrder = orderOf(targets, left.to) - orderOf(targets, right.to)

    if (targetOrder !== 0) {
      return targetOrder
    }

    return orderOf(sources, left.from) - orderOf(sources, right.from)
  })

  for (const flow of byTarget) {
    const y = targetCursor.get(flow.to) ?? top
    targetYs.set(flow.key, y)
    targetCursor.set(flow.to, y + flow.value * scale)
  }

  const placedFlows = bySource.map((flow) => {
    const sourceY = sourceYs.get(flow.key) ?? top
    const targetY = targetYs.get(flow.key) ?? top
    const thickness = flow.value * scale

    return { ...flow, sourceY, targetY, thickness }
  })

  return { sources: placedSources, targets: placedTargets, flows: placedFlows }
}

export function ribbonPath(
  { sourceY, targetY, thickness }: Pick<PlacedSankeyFlow, 'sourceY' | 'targetY' | 'thickness'>,
  sourceX: number,
  targetX: number
): string {
  const middle = (sourceX + targetX) / 2
  const sourceBottom = sourceY + thickness
  const targetBottom = targetY + thickness

  return [
    `M${sourceX} ${sourceY}`,
    `C${middle} ${sourceY} ${middle} ${targetY} ${targetX} ${targetY}`,
    `L${targetX} ${targetBottom}`,
    `C${middle} ${targetBottom} ${middle} ${sourceBottom} ${sourceX} ${sourceBottom}`,
    'Z'
  ].join(' ')
}
