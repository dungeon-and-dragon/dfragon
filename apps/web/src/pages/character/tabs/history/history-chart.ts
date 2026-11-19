import { formatSeoulMonthDay, formatSeoulTime } from '#shared/lib/time-format'
import type { LineAxisTick, LineTimeAxis } from '#shared/ui/chart/LineChart'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
// 한국 시간은 일광 절약 시간이 없어 UTC에서 늘 9시간 앞이다.
const SEOUL_OFFSET = 9 * HOUR
const MAX_TICKS = 4
const LONGEST_STEP = 365 * DAY
const TICK_STEPS = [
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  3 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  60 * DAY,
  90 * DAY,
  180 * DAY,
  LONGEST_STEP
]

function floorSeoul(time: number, unit: number): number {
  return Math.floor((time + SEOUL_OFFSET) / unit) * unit - SEOUL_OFFSET
}

function ceilSeoul(time: number, unit: number): number {
  return Math.ceil((time + SEOUL_OFFSET) / unit) * unit - SEOUL_OFFSET
}

function tickStepOf(span: number): number {
  const step = TICK_STEPS.find((candidate) => Math.floor(span / candidate) <= MAX_TICKS)

  if (step === undefined) {
    return LONGEST_STEP
  }

  return step
}

export function historyTimeAxis(times: readonly number[]): LineTimeAxis {
  const first = times[0] ?? 0
  const last = times.at(-1) ?? first
  const step = tickStepOf(last - first)
  const unit = Math.min(step, DAY)
  const min = floorSeoul(first, unit)
  const max = ceilSeoul(last, unit)
  const label = step >= DAY ? formatSeoulMonthDay : formatSeoulTime
  const ticks: LineAxisTick[] = []

  for (let at = ceilSeoul(first, unit); at <= last; at += step) {
    const text = label(at)
    ticks.push({ at, label: text })
  }

  return { min, max, ticks }
}
