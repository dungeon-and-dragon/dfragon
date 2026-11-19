export type Scale = Readonly<{ min: number; max: number; ticks: readonly number[] }>

export type Point = Readonly<{ index: number; value: number }>

const NICE_STEPS = [1, 2, 2.5, 5, 10]
const SPLIT_LABEL_MIN_SHARE = 0.12

function niceStep(span: number, count: number): number {
  const raw = span / count
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = NICE_STEPS.find((candidate) => candidate * power >= raw) ?? 10

  return step * power
}

function roundTick(value: number): number {
  return Number(value.toPrecision(12))
}

export function niceScale(min: number, max: number, count: number): Scale {
  const low = Math.min(min, max)
  const high = Math.max(min, max)
  const span = high > low ? high - low : Math.max(Math.abs(high), 1)
  const step = niceStep(span, count)
  const start = Math.floor(low / step) * step
  const end = Math.max(Math.ceil(high / step) * step, start + step)
  const tickCount = Math.round((end - start) / step)
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => roundTick(start + index * step))

  const first = ticks[0] ?? start
  const last = ticks.at(-1) ?? end

  return { min: first, max: last, ticks }
}

export function positionOf(value: number, scale: Scale, from: number, to: number): number {
  return from + ((value - scale.min) / (scale.max - scale.min)) * (to - from)
}

export function definedRuns(values: readonly (number | null)[]): Point[][] {
  const runs: Point[][] = []
  let run: Point[] = []
  for (const [index, value] of values.entries()) {
    if (value == null) {
      if (run.length > 0) {
        runs.push(run)
      }

      run = []
    } else {
      run.push({ index, value })
    }
  }

  if (run.length > 0) {
    runs.push(run)
  }

  return runs
}

export function lastDefined(values: readonly (number | null)[]): Point | undefined {
  return definedRuns(values).at(-1)?.at(-1)
}

export type StackPiece = Readonly<{ from: number; to: number; top: boolean }>

export function stackPieces(values: readonly number[]): StackPiece[] {
  const topIndex = values.findLastIndex((value) => value > 0)
  let from = 0

  return values.map((value, index) => {
    const to = from + Math.max(value, 0)
    const top = index === topIndex
    const piece = { from, to, top }
    from = to

    return piece
  })
}

export function splitLabelShown(value: number, total: number): boolean {
  return total > 0 && value / total >= SPLIT_LABEL_MIN_SHARE
}

function svgNumber(value: number): string {
  return value.toFixed(1)
}

export function topRoundedBarPath({
  x,
  width,
  top,
  bottom,
  radius
}: {
  x: number
  width: number
  top: number
  bottom: number
  radius: number
}): string {
  const r = Math.max(0, Math.min(radius, width / 2, bottom - top))
  const right = x + width

  return [
    `M${svgNumber(x)} ${svgNumber(bottom)}`,
    `V${svgNumber(top + r)}`,
    `Q${svgNumber(x)} ${svgNumber(top)} ${svgNumber(x + r)} ${svgNumber(top)}`,
    `H${svgNumber(right - r)}`,
    `Q${svgNumber(right)} ${svgNumber(top)} ${svgNumber(right)} ${svgNumber(top + r)}`,
    `V${svgNumber(bottom)}`,
    'Z'
  ].join(' ')
}

export function polylinePath(points: readonly Readonly<{ x: number; y: number }>[]): string {
  const [first, ...rest] = points
  if (first == null) {
    return ''
  }

  const start = `M${svgNumber(first.x)} ${svgNumber(first.y)}`
  if (rest.length === 0) {
    return `${start} h0`
  }

  return [start, ...rest.map(({ x, y }) => `L${svgNumber(x)} ${svgNumber(y)}`)].join(' ')
}

export function alignedScale(max: number, intervals: number): Scale {
  const count = Math.max(intervals, 1)
  const step = niceStep(max > 0 ? max : 1, count)
  const ticks = Array.from({ length: count + 1 }, (_, index) => roundTick(index * step))
  const top = roundTick(count * step)

  return { min: 0, max: top, ticks }
}

export type BoxStats = Readonly<{
  p5: number
  p25: number
  median: number
  p75: number
  p95: number
  max: number
}>

const BOX_PLOT_TICK_COUNT = 4

export function boxPlotScale(
  stats: readonly BoxStats[],
  tickCount = BOX_PLOT_TICK_COUNT
): Scale | undefined {
  if (stats.length === 0) {
    return undefined
  }

  const low = Math.min(...stats.map(({ p5 }) => p5))
  const high = Math.max(...stats.map(({ max }) => max))

  return niceScale(low, high, tickCount)
}
